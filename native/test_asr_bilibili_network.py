"""Regression coverage for Bilibili downloads blocked by a stale local proxy."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import asr


class BilibiliNetworkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.spec = {'videoKey': 'bilibili:BV1v7xP6qERt:1', 'url': 'https://www.bilibili.com/video/BV1v7xP6qERt/'}

    def run_download(self, outcomes, spec=None):
        calls = []

        def stream(command, env, on_line, tail=20):
            calls.append((list(command), dict(env)))
            code, output = outcomes[len(calls) - 1]
            if code == 0:
                (self.directory / 'audio.m4a').write_bytes(b'fixture audio')
            return code, output

        env = {'HTTPS_PROXY': 'http://127.0.0.1:7890'}
        with patch.object(asr, 'stream', stream), patch.object(asr, 'youtube_runtime_args', return_value=[]), patch.object(asr.time, 'sleep'):
            result = asr.download(self.directory, spec or self.spec, env, {'yt-dlp': 'test-ytdlp'})
        self.assertEqual(env, {'HTTPS_PROXY': 'http://127.0.0.1:7890'})
        return result, calls

    def test_bilibili_bypasses_a_stale_proxy_without_changing_the_environment(self):
        _, calls = self.run_download([(0, [])])
        command = calls[0][0]
        self.assertIn('--ignore-config', command)
        self.assertEqual(command[command.index('--proxy') + 1], '')
        self.assertEqual(command[command.index('--add-headers') + 1], 'Range:bytes=0-')

    def test_bilibili_recovers_from_direct_failure_and_unavailable_inherited_proxy(self):
        _, calls = self.run_download([
            (1, ['SSL: UNEXPECTED_EOF_WHILE_READING']),
            (1, ['Unable to connect to proxy: [WinError 10061] connection refused']),
            (0, []),
        ])
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[0][0][calls[0][0].index('--proxy') + 1], '')
        self.assertNotIn('--proxy', calls[1][0])
        self.assertEqual(calls[2][0][calls[2][0].index('--proxy') + 1], '')
        for command, _ in calls:
            self.assertIn('--ignore-config', command)
            self.assertEqual(command[command.index('--add-headers') + 1], 'Range:bytes=0-')

    def test_youtube_keeps_its_existing_proxy_behavior(self):
        _, calls = self.run_download([(0, [])], {'videoKey': 'youtube:abcdefghijk', 'url': 'https://www.youtube.com/watch?v=abcdefghijk'})
        self.assertNotIn('--proxy', calls[0][0])
        self.assertNotIn('--add-headers', calls[0][0])

    def test_truncated_download_still_retries(self):
        _, calls = self.run_download([(1, ['ERROR: Downloaded 1024 bytes, expected 2048 bytes']), (0, [])])
        self.assertEqual(len(calls), 2)

    def test_login_failure_is_not_retried_as_a_network_error(self):
        with self.assertRaises(asr.Failed) as caught:
            self.run_download([(1, ['ERROR: Login required'])])
        self.assertEqual(caught.exception.code, 'needs-cookies')

    def test_network_recovery_is_bounded(self):
        with self.assertRaises(asr.Failed):
            self.run_download([(1, ['Unable to connect to proxy'])] * 3)


if __name__ == '__main__':
    unittest.main()

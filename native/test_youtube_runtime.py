import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import asr

class YouTubeRuntimeTests(unittest.TestCase):
    def test_enables_supported_node_with_its_exact_path(self):
        path = '/Programs With Spaces/node'
        with patch.object(asr, 'find_tool', side_effect=lambda name: path if name == 'node' else None), patch.object(asr, 'tool_version', return_value='v22.11.0'):
            self.assertEqual(asr.youtube_runtime_args(), ['--js-runtimes', 'node:' + path])

    def test_prefers_deno_when_supported(self):
        with patch.object(asr, 'find_tool', side_effect=lambda name: '/tools/' + name), patch.object(asr, 'tool_version', side_effect=lambda path: 'deno 2.3.0' if path.endswith('deno') else 'v25.0.0'):
            self.assertEqual(asr.youtube_runtime_args(), ['--js-runtimes', 'deno:/tools/deno'])

    def test_missing_or_old_runtimes_leave_other_download_paths_available(self):
        with patch.object(asr, 'find_tool', return_value=None):
            self.assertEqual(asr.youtube_runtime_args(), [])
        with patch.object(asr, 'find_tool', side_effect=lambda name: '/tools/' + name), patch.object(asr, 'tool_version', side_effect=lambda path: 'deno 2.2.0' if path.endswith('deno') else 'v20.10.0'):
            self.assertEqual(asr.youtube_runtime_args(), [])

    def test_windows_node_install_is_found_when_browser_path_is_old(self):
        with tempfile.TemporaryDirectory() as directory:
            program = Path(directory) / 'nodejs/node.exe'; program.parent.mkdir(); program.write_bytes(b'fixture')
            with patch.object(asr.sys, 'platform', 'win32'), patch.dict(asr.os.environ, {'ProgramW6432': directory}), patch.object(asr.shutil, 'which', return_value=None):
                self.assertEqual(Path(asr.find_tool('node')), program)

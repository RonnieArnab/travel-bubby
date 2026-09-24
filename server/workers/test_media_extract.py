import unittest
from media_extract import parse_subtitles, choose_subtitle, dedupe_segments

class MediaEvidenceTests(unittest.TestCase):
    def test_rolling_captions_and_timestamps(self):
        raw = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nVisit Nishiki\n\n00:00:02.000 --> 00:00:03.000\nNishiki Market in Kyoto\n'
        result = parse_subtitles(raw, 'vtt')
        self.assertEqual(result, [{'start': 1.0, 'text': 'Visit Nishiki'}, {'start': 2.0, 'text': 'Market in Kyoto'}])
    def test_prefers_human_subtitles(self):
        result = choose_subtitle({'subtitles': {'ja': [{'url':'https://example.com/ja', 'ext':'vtt'}]}, 'automatic_captions': {'en': [{'url':'https://example.com/en', 'ext':'json3'}]}})
        self.assertEqual(result[1:], ('ja', 'captions'))
    def test_json3_and_markup(self):
        result = parse_subtitles('{"events":[{"tStartMs":2500,"segs":[{"utf8":"<b>Market</b> &amp; food"}]}]}', 'json3')
        self.assertEqual(result, [{'start':2.5,'text':'Market & food'}])
    def test_repeated_caption_cleaning(self):
        self.assertEqual(len(dedupe_segments([{'text':'<b>Kyoto</b>'},{'text':'Kyoto'}])), 1)

if __name__ == '__main__': unittest.main()

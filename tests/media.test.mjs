import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webUrl, videoSource, imageUrlFromTransfer } from '../utils/media.ts';

test('only accepts web URLs', () => {
  assert.equal(webUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(webUrl('javascript:alert(1)'), null);
  assert.equal(webUrl('data:image/png;base64,abc'), null);
});

test('normalizes supported video URLs and rejects unsupported hosts', () => {
  assert.deepEqual(videoSource('https://youtu.be/dQw4w9WgXcQ?t=1'), { kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  assert.deepEqual(videoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  assert.deepEqual(videoSource('https://vimeo.com/12345'), { kind: 'embed', url: 'https://player.vimeo.com/video/12345' });
  assert.deepEqual(videoSource('https://example.com/video.mp4?token=abc'), { kind: 'video', url: 'https://example.com/video.mp4?token=abc' });
  assert.equal(videoSource('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(videoSource('javascript:alert(1)'), null);
  assert.equal(videoSource('https://example.com/not-a-video'), null);
});

test('detects image addresses in dropped or pasted text', () => {
  const transfer = values => ({ getData: type => values[type] || '' });
  assert.equal(imageUrlFromTransfer(transfer({ 'text/plain': 'https://example.com/picture.JPG?x=1' })), 'https://example.com/picture.JPG?x=1');
  assert.equal(imageUrlFromTransfer(transfer({ 'text/uri-list': '# comment\nhttps://example.com/picture.png\n' })), 'https://example.com/picture.png');
  assert.equal(imageUrlFromTransfer(transfer({ 'text/plain': 'https://example.com/page' })), null);
});

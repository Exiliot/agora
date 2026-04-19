import { describe, expect, it } from 'vitest';
import { normaliseMime } from './routes.js';

describe('normaliseMime', () => {
  it('should keep allow-listed raster image mimes as-is', () => {
    expect(normaliseMime('image/png')).toBe('image/png');
    expect(normaliseMime('image/jpeg')).toBe('image/jpeg');
    expect(normaliseMime('image/gif')).toBe('image/gif');
    expect(normaliseMime('image/webp')).toBe('image/webp');
    expect(normaliseMime('image/avif')).toBe('image/avif');
  });

  it('should lowercase mixed-case allow-listed mimes', () => {
    expect(normaliseMime('IMAGE/PNG')).toBe('image/png');
    expect(normaliseMime('Image/Jpeg')).toBe('image/jpeg');
  });

  it('should reject SVG – it is the classic stored-XSS vector and must never render inline', () => {
    expect(normaliseMime('image/svg+xml')).toBe('application/octet-stream');
    expect(normaliseMime('IMAGE/SVG+XML')).toBe('application/octet-stream');
  });

  it('should reject HTML, JS, and other script-capable mimes', () => {
    expect(normaliseMime('text/html')).toBe('application/octet-stream');
    expect(normaliseMime('application/javascript')).toBe('application/octet-stream');
    expect(normaliseMime('application/xhtml+xml')).toBe('application/octet-stream');
  });

  it('should fall back to octet-stream for unknown mimes', () => {
    expect(normaliseMime('application/pdf')).toBe('application/octet-stream');
    expect(normaliseMime('video/mp4')).toBe('application/octet-stream');
    expect(normaliseMime('')).toBe('application/octet-stream');
  });
});

import { describe, expect, it } from 'vitest';
import { cookieStringToJar, parseCredentials } from './curlParse';

describe('parseCredentials', () => {
  it('extracts cookie and bearer from a "Copy as cURL" paste', () => {
    const curl = `curl 'https://www.10bis.co.il/NextApi/GetUser' \\
      -H 'authorization: Bearer abc.def.ghi' \\
      -H 'cookie: Authorization=tok123; .ASPXANONYMOUS=xyz' \\
      -H 'content-type: application/json' \\
      --data-raw '{}'`;
    const { cookie, bearer } = parseCredentials(curl);
    expect(bearer).toBe('abc.def.ghi');
    expect(cookie).toBe('Authorization=tok123; .ASPXANONYMOUS=xyz');
  });

  it('handles curl -b/--cookie form', () => {
    const { cookie } = parseCredentials(`curl https://x -b 'a=1; b=2'`);
    expect(cookie).toBe('a=1; b=2');
  });

  it('parses a raw request-header block', () => {
    const block = `Cookie: a=1; b=2\nAuthorization: Bearer xyz\nAccept: */*`;
    const { cookie, bearer } = parseCredentials(block);
    expect(cookie).toBe('a=1; b=2');
    expect(bearer).toBe('xyz');
  });

  it('accepts a bare cookie string', () => {
    const { cookie, bearer } = parseCredentials('Authorization=tok; sess=abc');
    expect(cookie).toBe('Authorization=tok; sess=abc');
    expect(bearer).toBeUndefined();
  });

  it('returns empty for junk', () => {
    expect(parseCredentials('hello world')).toEqual({});
  });
});

describe('cookieStringToJar', () => {
  it('splits a cookie header into a jar', () => {
    expect(cookieStringToJar('a=1; b=two; c=')).toEqual({ a: '1', b: 'two', c: '' });
  });
});

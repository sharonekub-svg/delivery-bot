import { Html, Head, Main, NextScript } from 'next/document';

/** Global document: Hebrew + right-to-left for the whole site. */
export default function Document() {
  return (
    <Html lang="he" dir="rtl">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

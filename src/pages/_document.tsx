import { Html, Head, Main, NextScript } from 'next/document';

/** Hebrew + RTL, dark, with the Instrument Serif / Barlow font pair. */
export default function Document() {
  return (
    <Html lang="he" dir="rtl">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&family=Frank+Ruhl+Libre:wght@400;500;700&family=Heebo:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="es" className="light">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <style>{`
          .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

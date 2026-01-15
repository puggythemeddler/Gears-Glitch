import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta name="description" content="Gear&Glitch — Computer store" />
          <meta id="themeColorMeta" name="theme-color" content="#0b1120" />
          <link rel="manifest" href="/manifest.webmanifest" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <script dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("siteTheme");if(!t){t=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t);var m=document.getElementById("themeColorMeta");if(m)m.content=t==="dark"?"#0b1120":"#f8fafc"}catch(e){}})()`
          }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

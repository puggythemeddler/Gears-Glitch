import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <title>Welcome to our store</title>
          <meta name="description" content="Kenya's all-in-one platform for premium PC hardware, laptops, graphics cards, servers, printers, and expert repair services. KRA eTIMS compliant invoicing. Shop now." />
          <meta name="keywords" content="computers Kenya, laptops Nairobi, PC builds Kenya, graphics cards, server hardware, printer sales, computer repair Kenya, tech shop Kenya" />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Welcome to our store" />
          <meta property="og:locale" content="en_KE" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta id="themeColorMeta" name="theme-color" content="#0b1120" />
          <link rel="shortcut icon" href="/default-favicon.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/default-favicon.png" />
          <link rel="apple-touch-icon" href="/default-favicon.png" />
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

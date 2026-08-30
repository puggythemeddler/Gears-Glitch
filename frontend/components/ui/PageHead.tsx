import React from "react";
import Head from "next/head";

export function PageHead({ title, description }: { title: string; description?: string }) {
  return (
    <Head>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
    </Head>
  );
}

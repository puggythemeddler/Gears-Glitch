import React from "react";
import { DynamicLayoutStyles, HeroSection, DynamicSectionView } from "@/layouts/dynamic-engine";
import type { DynamicLayoutConfig } from "@/layouts/dynamic-engine";
import { previewProducts, previewCategories } from "@/lib/template-fixtures";
import type { StorefrontTemplate } from "@/lib/templates";
import type { Product } from "@/lib/types";

type Device = "desktop" | "tablet" | "mobile";

interface TemplateLivePreviewProps {
  template: StorefrontTemplate;
  /** The merchant's real products; sample products are used when empty. */
  products?: Product[];
  categories?: { id: string; label: string }[];
  device?: Device;
}

/**
 * Renders a template with the real storefront engine, in-canvas, using the
 * merchant's own products when available and clearly-labelled sample data when
 * not. Read-only: the page is inert (no navigation) and nothing is written.
 */
export default function TemplateLivePreview({ template, products, categories, device = "desktop" }: TemplateLivePreviewProps) {
  const config = template.config as unknown as DynamicLayoutConfig;
  const prod = previewProducts(products);
  const cats = previewCategories(categories);
  const sections = config.sections ?? [];
  const usingSample = prod.demo || cats.demo;

  return (
    <div className="tpl-preview" data-device={device}>
      <div className="tpl-preview-bar">
        <span className="tpl-preview-dot" aria-hidden="true" />
        <strong className="tpl-preview-name">{template.name}</strong>
        <span className="tpl-preview-badge">Live preview</span>
      </div>
      <div className="tpl-preview-viewport">
        <div className="tpl-preview-page" aria-hidden="true">
          <div className="dynamic-layout">
            <DynamicLayoutStyles tokens={config.tokens} />
            <HeroSection hero={config.hero} colors={config.colors} products={prod.items} categories={cats.items} />
            {sections.map((section, i) => (
              <DynamicSectionView
                key={(section as { id?: string }).id || i}
                section={section}
                products={prod.items}
                categories={cats.items}
                colors={config.colors}
                cardConfig={config.productCard}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>
      {usingSample && (
        <p className="tpl-preview-note">
          Showing sample products and categories. This preview is not saved — apply the template, then Save Draft and Publish to go live.
        </p>
      )}
    </div>
  );
}

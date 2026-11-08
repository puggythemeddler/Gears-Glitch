import SiteMascotFace from "@/components/SiteMascotFace";
import { MASCOT_OPTIONS, type MascotId } from "@/lib/mascots";

export default function MascotPicker({ value, onChange, disabled = false }: {
  value: MascotId;
  onChange: (value: MascotId) => void;
  disabled?: boolean;
}) {
  const groups = ["GearHead", "East Africa", "Wildlife", "Other"] as const;

  return (
    <div className="mascot-picker" aria-label="Choose a storefront mascot">
      {groups.map((group) => {
        const options = MASCOT_OPTIONS.filter((option) => option.group === group);
        if (!options.length) return null;
        return (
          <section className="mascot-picker-group" key={group} aria-label={group}>
            <h4>{group === "GearHead" ? "Gear&Glitch original" : group === "East Africa" ? "East African editions" : group}</h4>
            <div className="mascot-picker-grid">
              {options.map((option) => {
                const selected = option.id === value;
                return (
                  <button
                    key={option.id}
                    className={`mascot-picker-option${selected ? " is-selected" : ""}${option.id === "none" ? " is-none" : ""}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(option.id)}
                    disabled={disabled}
                  >
                    <span className="mascot-picker-art" aria-hidden="true">
                      {option.id === "none" ? (
                        <span className="mascot-picker-off">Off</span>
                      ) : (
                        <svg viewBox="-52 -52 104 104" role="img" aria-label={`${option.name} preview`}>
                          <SiteMascotFace variant={option.id} expression="hopeful" />
                        </svg>
                      )}
                    </span>
                    <span className="mascot-picker-name">{option.name}</span>
                    <span className="mascot-picker-description">{option.description}</span>
                    {selected && <span className="mascot-picker-selected">Selected</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <style jsx>{`
        .mascot-picker { display: grid; gap: 1rem; }
        .mascot-picker-group { margin: 0; }
        .mascot-picker-group h4 { margin: 0 0 .55rem; color: var(--text-secondary); font-size: .75rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
        .mascot-picker-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; }
        .mascot-picker-option { position: relative; display: grid; justify-items: start; align-content: start; gap: .16rem; min-width: 0; min-height: 142px; padding: .55rem; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); text-align: left; cursor: pointer; transition: border-color 140ms ease, background-color 140ms ease, transform 140ms ease; }
        .mascot-picker-option:hover:not(:disabled) { border-color: var(--primary); transform: translateY(-1px); }
        .mascot-picker-option:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 42%, transparent); outline-offset: 2px; }
        .mascot-picker-option.is-selected { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); background: color-mix(in srgb, var(--primary-subtle) 48%, var(--surface)); }
        .mascot-picker-option:disabled { opacity: .6; cursor: progress; }
        .mascot-picker-art { display: grid; place-items: center; width: 100%; height: 76px; border-radius: 8px; background: var(--bg); }
        .mascot-picker-art svg { width: 70px; height: 70px; overflow: visible; }
        .mascot-picker-off { display: grid; place-items: center; width: 48px; height: 48px; border: 1px dashed var(--text-tertiary); border-radius: 50%; color: var(--text-secondary); font-size: .75rem; font-weight: 700; }
        .mascot-picker-name { font-size: .79rem; font-weight: 700; line-height: 1.25; }
        .mascot-picker-description { color: var(--text-tertiary); font-size: .68rem; line-height: 1.35; }
        .mascot-picker-selected { position: absolute; right: .45rem; top: .45rem; padding: .18rem .35rem; border-radius: 999px; background: var(--primary); color: var(--on-primary); font-size: .57rem; font-weight: 700; }
        @media (prefers-reduced-motion: reduce) { .mascot-picker-option { transition: none; } }
      `}</style>
    </div>
  );
}

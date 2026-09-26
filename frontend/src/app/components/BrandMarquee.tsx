import Container from "./Container";

const BRANDS = [
  "Michelin",
  "Goodyear",
  "Bridgestone",
  "Continental",
  "Pirelli",
  "Hankook",
  "Yokohama",
  "Toyo Tires",
  "BFGoodrich",
  "Cooper",
  "Dunlop",
  "Firestone",
];

export default function BrandMarquee() {
  return (
    <div className="border-y border-border bg-background-light py-8">
      <Container>
        <p className="text-center text-xs font-bold uppercase tracking-widest text-text-secondary">
          Certified Installation & Stock For All Major Tire Brands
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 opacity-85">
          {BRANDS.map((brand) => (
            <span
              key={brand}
              className="text-sm font-extrabold tracking-wider text-slate-500 transition hover:text-foreground hover:scale-105"
            >
              {brand.toUpperCase()}
            </span>
          ))}
        </div>
      </Container>
    </div>
  );
}

export function EgonomistBanner() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-6 sm:px-8">
      <div className="border-4 border-amber-600 bg-black px-6 py-6 text-center">
        <span className="inline-block bg-amber-600 px-3 py-1 text-xs font-black tracking-widest text-black uppercase">
          EGONOMIST
        </span>
        <h2 className="mt-3 font-display text-2xl font-black text-amber-500 sm:text-3xl">
          We invented counting to keep everyone fed, then turned the balance sheet into a battlefield.
        </h2>
        <p className="mt-2 text-sm text-amber-200 italic">
          Economics began as oikonomia—the simple, humble stewardship of a shared home. When ego took the pen, sharing became scoring, and counting became conquest. The math never shed a drop of blood; it is only the pride behind the balance sheet that demands a sacrifice.
        </p>
        <p className="mt-4">
          <a
            href="https://lgme.app/egonomist.html"
            className="inline-block min-h-11 border-2 border-amber-600 bg-amber-600 px-5 py-2 text-sm font-bold text-black"
          >
            Read the full poem
          </a>
        </p>
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { EgonomistBanner } from "../components/egonomist-banner";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main>
      <EgonomistBanner />
      <div className="p-8">
        <p>lgme</p>
      </div>
    </main>
  );
}

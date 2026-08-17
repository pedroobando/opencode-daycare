import { Sidebar } from "@/app/components/feed/Sidebar";
import { MobileDrawer } from "@/app/components/feed/MobileDrawer";
import { CreatePostPrompt } from "@/app/components/feed/CreatePostPrompt";
import { SectionDivider } from "@/app/components/feed/SectionDivider";
import { PostCard } from "@/app/components/feed/PostCard";
import { posts } from "@/app/lib/posts";

function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${weekday} ${day} ${month}`;
}

export default function HomePage() {
  const today = new Date();
  const dateLabel = formatDate(today);

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 pb-20 pt-8 sm:px-10">
          <MobileDrawer />
          <header className="mb-6">
            <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-primary">
              GUARDERÍA · SALA SOLES
            </div>
            <h1 className="font-display text-[30px] font-semibold text-foreground">
              Buenas, Caro
            </h1>
            <p className="mt-1 text-[14.5px] text-muted-light">
              12 niños · {dateLabel}
            </p>
          </header>

          <CreatePostPrompt />
          <SectionDivider label="PUBLICADO HOY" />

          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { Sidebar } from '@/app/components/feed/Sidebar';
import { MobileDrawer } from '@/app/components/feed/MobileDrawer';
import { CreatePostPrompt } from '@/app/components/feed/CreatePostPrompt';
import { SectionDivider } from '@/app/components/feed/SectionDivider';
import { PostCard } from '@/app/components/feed/PostCard';
import { CreatePostModal } from '@/app/components/feed/CreatePostModal';
import { posts } from '@/app/lib/posts';
import type { Post } from '@/app/lib/posts';
import { kids } from '@/app/lib/kids';
import type { SidebarUser } from '@/lib/supabase/current-user';

const formatDate = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';

  return `${weekday} ${day} ${month}`;
};

interface FeedBodyProps {
  currentUser?: SidebarUser | null;
}

export const FeedBody = ({ currentUser }: FeedBodyProps) => {
  const [postsList, setPostsList] = useState<Post[]>(posts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const sortedKids = useMemo(() => {
    return [...kids].sort((a, b) =>
      a.firstName.localeCompare(b.firstName, 'es'),
    );
  }, []);

  const today = new Date();
  const dateLabel = formatDate(today);
  const firstName =
    currentUser?.fullName.trim().split(/\s+/)[0] ?? 'amigo';

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddPost = (post: Post) => {
    setPostsList((previous) => [post, ...previous]);
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex">
        <Sidebar
          currentUser={currentUser}
          onNewPost={handleOpenModal}
          triggerRef={triggerRef}
        />
      </div>

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 pb-20 pt-8 sm:px-10">
          <MobileDrawer
            currentUser={currentUser}
            onNewPost={handleOpenModal}
            triggerRef={triggerRef}
          />
          <header className="mb-6">
            <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-primary">
              GUARDERÍA · SALA SOLES
            </div>
            <h1 className="font-display text-[30px] font-semibold text-foreground">
              Buenas, {firstName}
            </h1>
            <p className="mt-1 text-[14.5px] text-muted-light">
              12 niños · {dateLabel}
            </p>
          </header>

          <CreatePostPrompt />
          <SectionDivider label="PUBLICADO HOY" />

          <div className="flex flex-col gap-4">
            {postsList.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </main>

      <CreatePostModal
        open={isModalOpen}
        onClose={handleCloseModal}
        allKids={sortedKids}
        onAddPost={handleAddPost}
        triggerRef={triggerRef}
      />
    </div>
  );
};

'use client';

import { useState } from 'react';
import type { Post } from '@/app/lib/posts';
import {
  HeartIcon,
  CommentIcon,
  ImagePlaceholderIcon,
  MegaphoneIcon,
} from '@/app/components/icons';
import { getAvatarTextColor } from '@/app/lib/kids';

interface PostCardProps {
  post: Post;
}

const Badge = ({ type }: { type: Post['type'] }) => {
  const config = {
    achievement: {
      label: 'LOGRO',
      bgClass: 'bg-achievement-bg',
      textClass: 'text-achievement-text',
    },
    activity: {
      label: 'ACTIVIDAD',
      bgClass: 'bg-activity-bg',
      textClass: 'text-activity-text',
    },
    announcement: {
      label: 'ANUNCIO',
      bgClass: 'bg-announcement-bg',
      textClass: 'text-announcement-text',
    },
    meal: {
      label: 'COMIDA',
      bgClass: 'bg-meal-bg',
      textClass: 'text-meal-text',
    },
    nap: {
      label: 'SIESTA',
      bgClass: 'bg-nap-bg',
      textClass: 'text-nap-text',
    },
    mood: {
      label: 'ÁNIMO',
      bgClass: 'bg-mood-bg',
      textClass: 'text-mood-text',
    },
    photo: {
      label: 'FOTO',
      bgClass: 'bg-photo-bg',
      textClass: 'text-photo-text',
    },
  };

  const { label, bgClass, textClass } = config[type];

  return (
    <div
      className={`flex items-center gap-[7px] rounded-full px-3 py-[6px] ${bgClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${textClass}`} />
      <span className={`text-xs font-extrabold tracking-wide ${textClass}`}>
        {label}
      </span>
    </div>
  );
}

const Avatar = ({ post }: { post: Post }) => {
  if (post.type === 'announcement') {
    return (
      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-avatar-indigo text-announcement-text">
        <MegaphoneIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full font-display text-[17px] font-semibold"
      style={{
        backgroundColor: post.author.color,
        color: getAvatarTextColor(post.author.color),
      }}
    >
      {post.author.initial}
    </div>
  );
}

export const PostCard = ({ post }: PostCardProps) => {
  const [liked, setLiked] = useState(false);
  const likeCount = liked ? post.likes + 1 : post.likes;

  const handleLikeClick = () => {
    setLiked((previous) => !previous);
  };

  const preventDefault = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  return (
    <article className="rounded-[20px] border border-card-border bg-card p-5 shadow-[0_4px_16px_-12px_rgba(120,90,60,0.5)]">
      <div className="mb-3.5 flex items-center gap-3">
        <Avatar post={post} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16.5px] font-semibold text-foreground">
            {post.author.name}
          </div>
          <div className="text-[12.5px] text-muted-lighter">
            {post.time} · {post.publishedBy}
          </div>
        </div>
        <Badge type={post.type} />
      </div>

      <div className="mb-2.5 text-[12.5px] text-muted-lighter">
        Para: {post.recipientLabel}
      </div>

      <p className="text-[15.5px] leading-relaxed text-foreground/90">
        {post.content}
      </p>

      {post.type === 'activity' && post.photo && (
        <a
          href="#"
          onClick={preventDefault}
          className="mt-3.5 flex h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-placeholder-border bg-placeholder-bg text-placeholder-text"
        >
          <ImagePlaceholderIcon className="h-[30px] w-[30px]" />
          <span className="text-[13.5px]">{post.photo.alt}</span>
        </a>
      )}

      <div className="mt-4 flex items-center gap-[18px] border-t border-card-border pt-3.5">
        <button
          type="button"
          onClick={handleLikeClick}
          className="flex items-center gap-[7px] text-sm font-bold text-accent transition-opacity hover:opacity-80"
        >
          <HeartIcon className="h-[19px] w-[19px]" filled={liked} />
          <span>{likeCount}</span>
        </button>

        <a
          href="#"
          onClick={preventDefault}
          className="flex items-center gap-[7px] text-sm font-bold text-muted-light"
        >
          <CommentIcon className="h-[18px] w-[18px]" />
          <span>{post.comments}</span>
        </a>

        <span className="flex-1" />

        <a
          href="#"
          onClick={preventDefault}
          className="text-sm font-extrabold text-accent-dark"
        >
          Editar
        </a>
      </div>
    </article>
  );
}

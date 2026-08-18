'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '@/app/components/feed/Sidebar';
import { MobileDrawer } from '@/app/components/feed/MobileDrawer';
import { PlusIcon } from '@/app/components/icons';
import { SearchInput } from '@/app/components/kids/SearchInput';
import { RoomDivider } from '@/app/components/kids/RoomDivider';
import { KidCard } from '@/app/components/kids/KidCard';
import { rooms, kids } from '@/app/lib/kids';

const normalize = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

export default function KidsPage() {
  const [query, setQuery] = useState('');

  const normalizedQuery = normalize(query.trim());

  const filteredKids = useMemo(() => {
    if (normalizedQuery === '') {
      return kids;
    }

    return kids.filter((kid) => {
      const fullName = normalize(`${kid.firstName} ${kid.lastName}`);
      return fullName.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const kidsByRoom = useMemo(() => {
    return rooms.map((room) => ({
      ...room,
      kids: filteredKids.filter((kid) => kid.roomId === room.id),
    }));
  }, [filteredKids]);

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[880px] px-6 pb-20 pt-8 sm:px-10">
          <MobileDrawer />

          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-1 text-[12.5px] font-extrabold uppercase tracking-[0.8px] text-primary">
                GESTIÓN
              </div>
              <h1 className="font-display text-[30px] font-semibold text-foreground">
                Niños
              </h1>
            </div>
            <a
              href="#"
              onClick={(event) => event.preventDefault()}
              className="flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-b from-primary-gradient-start to-primary-gradient-end px-[18px] py-[11px] text-center text-[14.5px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(238,129,100,0.7)]"
            >
              <PlusIcon className="h-[17px] w-[17px]" />
              Agregar niño
            </a>
          </div>

          <div className="mb-5">
            <SearchInput value={query} onChange={setQuery} />
          </div>

          {filteredKids.length === 0 && (
            <p className="py-10 text-center text-[15px] text-muted-light">
              No se encontraron niños que coincidan con “{query}”.
            </p>
          )}

          {kidsByRoom.map(
            (room) =>
              room.kids.length > 0 && (
                <section key={room.id}>
                  <RoomDivider roomName={room.name} kidCount={room.kids.length} />
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {room.kids.map((kid) => (
                      <KidCard key={kid.id} kid={kid} />
                    ))}
                  </div>
                </section>
              )
          )}
        </div>
      </main>
    </div>
  );
}

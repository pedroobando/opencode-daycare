import Link from 'next/link';
import { ArrowLeftIcon } from '@/app/components/icons';

interface KidNotFoundProps {
  message?: string;
}

export const KidNotFound = ({
  message = 'No encontramos al niño que buscás.',
}: KidNotFoundProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary-light text-primary">
        <span className="font-display text-4xl font-semibold">?</span>
      </div>
      <h2 className="mb-2 font-display text-2xl font-semibold text-foreground">
        Niño inexistente
      </h2>
      <p className="mb-6 max-w-xs text-[15px] text-muted-light">{message}</p>
      <Link
        href="/kids"
        className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
      >
        <ArrowLeftIcon className="h-[18px] w-[18px]" />
        Volver a Niños
      </Link>
    </div>
  );
};

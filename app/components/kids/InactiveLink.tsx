'use client';

interface InactiveLinkProps {
  href?: string;
  children: React.ReactNode;
  className?: string;
}

export const InactiveLink = ({
  href = '#',
  children,
  className,
}: InactiveLinkProps) => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};

import { LogoIcon } from '@/app/components/icons';

export default function AuthLayout({ children }: LayoutProps<'/auth'>) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background md:grid-cols-[1.05fr_1fr]">
      {/* Left brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#F6A98E] via-[#F2937A] to-[#EC7E62] p-14 text-white md:flex">
        {/* Decorative circles */}
        <div className="absolute -right-[120px] -top-[140px] h-[420px] w-[420px] rounded-full bg-white/10" />
        <div className="absolute -bottom-[110px] -left-[80px] h-[300px] w-[300px] rounded-full bg-white/10" />

        <div className="relative flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/20">
            <LogoIcon className="h-7 w-7 text-white" />
          </div>
          <span className="font-display text-[21px] font-semibold tracking-wide">
            OpenDayCare
          </span>
        </div>

        <div className="relative max-w-[430px]">
          <h1 className="font-display text-[42px] font-semibold leading-[1.12]">
            El día de cada niño,
            <br />
            compartido con su familia.
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-white/90">
            Publicá momentos, gestioná las salas y mantené a las familias cerca,
            desde un solo lugar.
          </p>
        </div>

        <div className="relative text-sm text-white/90">
          🌿 Guardería Sala Soles
        </div>
      </aside>

      {/* Right content area */}
      <main className="flex flex-1 items-center justify-center p-10">
        {children}
      </main>
    </div>
  );
}

import { AlertTriangleIcon } from '@/app/components/icons';

interface AllergyAlertProps {
  allergies: string;
}

export const AllergyAlert = ({ allergies }: AllergyAlertProps) => {
  return (
    <div className="flex gap-3.5 rounded-2xl bg-[#FBDAD6] p-4">
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[#F4A8A0]">
        <AlertTriangleIcon className="h-[22px] w-[22px] text-white" />
      </div>
      <div>
        <div className="mb-0.5 text-[15px] font-extrabold text-[#C5413A]">
          Alergias y notas
        </div>
        <p className="text-[14.5px] leading-relaxed text-[#B25249]">
          {allergies}
        </p>
      </div>
    </div>
  );
};

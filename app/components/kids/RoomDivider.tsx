interface RoomDividerProps {
  roomName: string;
  kidCount: number;
}

export const RoomDivider = ({ roomName, kidCount }: RoomDividerProps) => {
  return (
    <div className="mb-3.5 mt-5 flex items-center gap-3">
      <span className="text-[12.5px] font-extrabold tracking-[0.8px] text-foreground">
        {roomName.toUpperCase()}
      </span>
      <span className="text-[13px] text-muted-lighter">
        {kidCount} {kidCount === 1 ? 'niño' : 'niños'}
      </span>
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
};

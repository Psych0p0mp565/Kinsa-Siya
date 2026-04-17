import { avatarSvg, type Character } from "@guess-who/shared";

export function AvatarTile({
  character,
  down,
  isSelf,
  onClick,
}: {
  character: Character;
  down: boolean;
  isSelf: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`tile ${down ? "down" : ""} ${isSelf ? "self" : ""}`} onClick={onClick}>
      <div dangerouslySetInnerHTML={{ __html: avatarSvg(character.seed, character.themeId) }} />
      <div className="tileName">{character.displayName}</div>
    </button>
  );
}

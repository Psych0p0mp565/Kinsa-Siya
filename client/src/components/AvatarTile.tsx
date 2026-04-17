import { useEffect, useState } from "react";
import { avatarSvg, type Character } from "@guess-who/shared";

export function AvatarTile({
  character,
  down,
  isSelf,
  lockedGuess,
  onClick,
}: {
  character: Character;
  down: boolean;
  isSelf: boolean;
  /** Highlight when this face is the locked final guess (picked or sole survivor). */
  lockedGuess?: boolean;
  onClick: () => void;
}) {
  const [imgOk, setImgOk] = useState(() => Boolean(character.portraitUrl));

  useEffect(() => {
    setImgOk(Boolean(character.portraitUrl));
  }, [character.portraitUrl, character.id]);

  const showPhoto = Boolean(character.portraitUrl && imgOk);

  return (
    <button
      type="button"
      className={`tile ${down ? "down" : ""} ${isSelf ? "self" : ""} ${lockedGuess ? "tile--guessPick" : ""}`}
      onClick={onClick}
    >
      {showPhoto ? (
        <img
          className="tilePortrait"
          src={character.portraitUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: avatarSvg(character.seed, character.themeId) }} />
      )}
      <div className="tileName">{character.displayName}</div>
    </button>
  );
}

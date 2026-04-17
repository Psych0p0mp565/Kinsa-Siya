import { useEffect, useState } from "react";
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
  const [imgOk, setImgOk] = useState(() => Boolean(character.portraitUrl));

  useEffect(() => {
    setImgOk(Boolean(character.portraitUrl));
  }, [character.portraitUrl, character.id]);

  const showPhoto = Boolean(character.portraitUrl && imgOk);

  return (
    <button type="button" className={`tile ${down ? "down" : ""} ${isSelf ? "self" : ""}`} onClick={onClick}>
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

import { useState } from "react";
import { Coffee, MapPin, Mountain, ShoppingBag, Landmark } from "lucide-react";

// A category cover is explicit artwork, never an unrelated photograph of a place.
export function PlaceImage({ place, className = "", children }) {
  const [failed, setFailed] = useState(false);
  const cat = (place.category || "").toLowerCase();
  const Icon = /food|cafe|coffee|restaurant/.test(cat)
    ? Coffee
    : /market|shop/.test(cat)
      ? ShoppingBag
      : /temple|culture|shrine/.test(cat)
        ? Landmark
        : /nature|park|view/.test(cat)
          ? Mountain
          : MapPin;
  const tone = /food|cafe|coffee|restaurant/.test(cat)
    ? "peach"
    : /market|shop/.test(cat)
      ? "butter"
      : "sage";
  return (
    <div className={`place-cover ${tone} ${className}`}>
      {place.image_url && !failed ? (
        <img
          src={place.image_url}
          alt={place.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="place-art"
          aria-label={`${place.category || "Place"} category illustration`}
        >
          <div className="art-orbit" />
          <span>
            <Icon size={34} strokeWidth={1.25} />
          </span>
          <i>✳</i>
        </div>
      )}
      {children}
    </div>
  );
}

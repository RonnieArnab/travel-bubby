import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  Footprints,
  Globe2,
  Instagram,
  Link2,
  MapPin,
  Menu,
  Play,
  Route,
  Sparkles,
  Users,
  X,
  Youtube,
} from "lucide-react";
import { DESTINATIONS } from "../lib/destinations.js";
import "../styles/landing.css";
const TravelGlobe = lazy(() => import("../components/TravelGlobe.jsx"));

export function LandingPage() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="wander-landing">
      <div className="announcement">
        <span>A little less scrolling. A lot more exploring.</span>
        <Compass size={13} />
      </div>
      <header className="wander-nav wrap">
        <Link to="/" className="wander-brand">
          <span className="wander-logo">
            <Compass size={24} />
          </span>
          travel<span>buddy</span>
          <i />
        </Link>
        <nav
          className={menu ? "marketing-links open" : "marketing-links"}
          aria-label="Main navigation"
        >
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#destinations" onClick={() => setMenu(false)}>
            Made for your next trip
          </a>
          <Link to="/groups">
            Travel together <Users size={14} />
          </Link>
        </nav>
        <Link className="nav-cta" to="/places">
          Start exploring <ArrowUpRight size={16} />
        </Link>
        <button
          className="mobile-menu"
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main>
        <section className="wander-hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-star">✳</span> YOUR SAVED REELS HAVE PLACES
              TO BE
            </div>
            <h1>
              From{" "}
              <span className="saved-word">
                “saved”
                <svg viewBox="0 0 270 18" aria-hidden="true">
                  <path d="M4 12Q120 -2 262 10M35 17Q130 6 245 14" />
                </svg>
              </span>
              <br />
              to <em>“we’re here.”</em>
            </h1>
            <p>
              That tiny ramen spot. That hidden beach. That reel you sent the
              group chat. Turn your someday saves into your next great
              adventure.
            </p>
            <div className="hero-actions">
              <Link to="/import" className="travel-button">
                Make it a trip <ArrowUpRight size={18} />
              </Link>
              <a href="#how-it-works" className="how-link">
                <span>
                  <Play size={12} fill="currentColor" />
                </span>
                See how it works
              </a>
            </div>
            <div className="hero-note">
              <span>
                <Check size={13} /> No sign-up needed
              </span>
              <span>
                <Check size={13} /> Better with your people
              </span>
            </div>
            <div className="source-note">
              <span>FROM YOUR FEED TO YOUR FEET</span>
              <Instagram size={17} />
              <Youtube size={20} />
              <Link2 size={17} />
            </div>
          </div>
          <div className="globe-scene">
            <div className="scene-orbit orbit-one" />
            <div className="scene-orbit orbit-two" />
            <span className="scene-spark spark-one">✦</span>
            <span className="scene-spark spark-two">✳</span>
            <Suspense fallback={<div className="globe-fallback" />}>
              <TravelGlobe />
            </Suspense>
            <Link
              to="/map?destination=japan"
              className="floating-postcard postcard-japan"
            >
              <div className="postcard-photo">
                <img
                  src="/assets/kyoto.jpg"
                  alt="Traditional streets and pagoda in Kyoto, Japan"
                  fetchPriority="high"
                />
                <span>
                  <Play size={11} fill="currentColor" /> FROM YOUR NEXT CHAPTER
                </span>
                <i>
                  <Bookmark size={15} fill="currentColor" />
                </i>
              </div>
              <div className="postcard-caption">
                <span>
                  <b>A little lost in Kyoto</b>
                  <small>
                    <MapPin size={11} /> Kyoto, Japan
                  </small>
                </span>
                <ArrowUpRight size={20} />
              </div>
            </Link>
            <Link
              to="/map?destination=thailand"
              className="floating-postcard postcard-thailand"
            >
              <div className="postcard-photo">
                <img
                  src="/assets/thailand.jpg"
                  alt="Ornate golden temple architecture in Thailand"
                />
                <i>
                  <Bookmark size={13} />
                </i>
              </div>
              <div className="postcard-caption">
                <span>
                  <b>Thailand is calling</b>
                  <small>
                    <MapPin size={11} /> Your next adventure
                  </small>
                </span>
              </div>
            </Link>
            <div className="floating-pill saved-pill">
              <span>
                <Check size={15} />
              </span>
              <div>
                A place for every save<small>Less searching. More going.</small>
              </div>
              <Sparkles size={16} />
            </div>
            <div className="floating-pill together-pill">
              <span className="mini-avatars">
                <i>A</i>
                <i>S</i>
                <i>J</i>
              </span>
              <div>
                One trip. Your people.
                <small>Build the adventure together</small>
              </div>
            </div>
            <div className="globe-caption">
              <Globe2 size={13} /> A whole world beyond your saved folder{" "}
              <span>↔ drag to explore</span>
            </div>
          </div>
        </section>
        <div className="promise-strip">
          <div className="wrap">
            <span>
              <Bookmark size={17} /> Save the inspiration
            </span>
            <i>✦</i>
            <span>
              <MapPin size={17} /> Find the actual place
            </span>
            <i>✦</i>
            <span>
              <Users size={17} /> Bring your people
            </span>
            <i>✦</i>
            <span>
              <Footprints size={17} /> Take a new path
            </span>
          </div>
        </div>
        <section className="workflow-section wrap" id="how-it-works">
          <div className="section-heading">
            <div>
              <div className="eyebrow">LESS PLANNING. MORE LIVING.</div>
              <h2>
                Your next trip is already
                <br />
                in your <em>saved folder.</em>
              </h2>
            </div>
            <p>
              Give all those “we should go here” moments
              <br className="desktop-break" /> a little direction. We’ll help
              with the rest.
            </p>
          </div>
          <div className="workflow-grid">
            <article className="workflow-card peach">
              <div className="step-top">
                <span>01 / COLLECT</span>
                <Link2 size={20} />
              </div>
              <div className="save-illustration">
                <span className="social-tile instagram-tile">
                  <Instagram size={29} />
                </span>
                <span className="social-tile youtube-tile">
                  <Youtube size={31} />
                </span>
                <div className="mini-link">
                  <Link2 size={13} /> instagram.com/reel/…{" "}
                  <span>
                    <Check size={13} />
                  </span>
                </div>
                <span className="mini-label">
                  <Sparkles size={12} /> Inspiration, meet organization.
                </span>
              </div>
              <h3>Save it. Don’t lose it.</h3>
              <p>
                Drop in a reel, short, or Maps link. Pull out the good stuff and
                keep the places worth going.
              </p>
              <Link to="/import">
                Save your first link <ArrowRight size={15} />
              </Link>
            </article>
            <article className="workflow-card sage">
              <div className="step-top">
                <span>02 / CONNECT THE DOTS</span>
                <MapPin size={20} />
              </div>
              <div className="mini-map">
                <div className="map-river" />
                <div className="map-road road-one" />
                <div className="map-road road-two" />
                <div className="map-road road-three" />
                <svg viewBox="0 0 300 150">
                  <path d="M58 116Q90 15 156 75T252 33" />
                </svg>
                <span className="mini-pin pin-a">
                  <MapPin size={20} fill="currentColor" />
                </span>
                <span className="mini-pin pin-b">
                  <MapPin size={20} fill="currentColor" />
                </span>
                <span className="map-label">
                  <span>🍜</span> That ramen spot <Check size={12} />
                </span>
              </div>
              <h3>Less tabs. More together.</h3>
              <p>
                Put your places on the map. Make a shared trip, invite your
                friends, and plan in one happy place.
              </p>
              <Link to="/groups">
                Meet your travel crew <ArrowRight size={15} />
              </Link>
            </article>
            <article className="workflow-card butter">
              <div className="step-top">
                <span>03 / GO A LITTLE FURTHER</span>
                <Route size={20} />
              </div>
              <div className="walk-illustration">
                <div className="compass-object">
                  <span>N</span>
                  <div className="compass-ring">
                    <div className="compass-needle" />
                  </div>
                  <small>S</small>
                </div>
                <div className="new-path">
                  <span>
                    <Footprints size={16} />
                  </span>
                  <div>
                    A fresh path awaits
                    <small>Find your next unvisited spot</small>
                  </div>
                </div>
              </div>
              <h3>Wander. Without the repeat.</h3>
              <p>
                Track your walks, remember where you’ve been, and plan your next
                stop somewhere new.
              </p>
              <Link to="/map?mode=walk">
                Find your own way <ArrowRight size={15} />
              </Link>
            </article>
          </div>
        </section>
        <section className="destinations-section wrap" id="destinations">
          <div className="section-heading">
            <div>
              <div className="eyebrow">WHERE WILL YOUR SAVES TAKE YOU?</div>
              <h2>
                A world of <em>“let’s go.”</em>
              </h2>
            </div>
            <Link to="/places" className="text-link">
              Make your own collection <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="destination-grid">
            {DESTINATIONS.map((d, i) => (
              <Link
                key={d.id}
                to={`/map?destination=${d.id}`}
                className="destination-card"
              >
                <img src={d.image} alt={d.location} loading="lazy" />
                <span className="destination-tag">{d.tag}</span>
                <span className="destination-number">0{i + 1}</span>
                <div>
                  <small>{d.subtitle}</small>
                  <h3>
                    {d.name}
                    <span>
                      <ArrowUpRight size={23} />
                    </span>
                  </h3>
                </div>
              </Link>
            ))}
          </div>
          <p className="destination-disclaimer">
            <Compass size={13} /> A little inspiration to get you started.
            Explore real places on the map.
          </p>
        </section>
        <section className="together-section wrap">
          <div className="together-picture">
            <img
              src="/assets/bali.jpg"
              alt="A Balinese temple beside a lake"
              loading="lazy"
            />
            <div className="trip-ticket">
              <span>THE GROUP CHAT, BUT GOING PLACES</span>
              <b>
                Same trip.
                <br />
                Different wish lists.
              </b>
              <div>
                <span className="ticket-avatars">A S J</span>
                <Users size={24} />
              </div>
              <hr />
              <small>
                EVERYONE’S INVITED <span>✳</span>
              </small>
            </div>
          </div>
          <div className="together-copy">
            <div className="eyebrow">GOOD PLACES. EVEN BETTER COMPANY.</div>
            <h2>
              You bring the people.
              <br />
              We’ll bring it <em>together.</em>
            </h2>
            <p>
              No more digging through the group chat for that one link. Your
              crew’s places, trip notes, and big little plans, all in a shared
              space.
            </p>
            <Link to="/groups" className="travel-button">
              Plan something together <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="final-cta">
          <span className="cta-spark">✳</span>
          <div className="eyebrow">THE BEST STORIES START WITH “LET’S GO”</div>
          <h2>
            Your next adventure.
            <br />
            <em>Already saved. Almost lived.</em>
          </h2>
          <Link to="/import" className="travel-button">
            Let’s make it happen <ArrowUpRight size={18} />
          </Link>
          <small>A link, a little curiosity, and you’re on your way.</small>
        </section>
      </main>
      <footer className="wander-footer wrap">
        <Link to="/" className="wander-brand">
          <span className="wander-logo">
            <Compass size={21} />
          </span>
          travel<span>buddy</span>
          <i />
        </Link>
        <p>Made for the places you haven’t been. Yet.</p>
        <a href="/assets/credits.md" target="_blank" rel="noreferrer">
          Photo & asset credits <ArrowUpRight size={13} />
        </a>
        <span>Go find your somewhere. ↗</span>
      </footer>
    </div>
  );
}

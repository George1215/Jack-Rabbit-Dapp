// src/pages/Landing.js
import { useEffect, useState } from 'react';
import { JACK, CHART } from './protocol';
import sack from './assets/sack.png';
import styles from './Landing.module.css';
import catchme from './assets/catchme.png';
//import jackrabbit from './assets/jackrabbit.png';
const jacklaughing = '/assets/jacklaughing.gif';
//import sack from './assets/sack.png';
import richrabbit from './assets/richrabbit.png';
import tokenomics from './assets/tokenomics.png';
import chart from './assets/chart.png';
import joinus from './assets/joinus.png';
import telegram from './assets/telegram.png';
import xlogo from './assets/xlogo.png';
import cashrabbit from './assets/cashrabbit.png';
import howjackruns from './assets/howjackruns.png';
import jackriding from './assets/Jackriding.png';
import jacklogo from './assets/jacklogo.png';

export default function Landing() {
  const [scrollX, setScrollX] = useState(0);

  const [copyMessage, setCopyMessage] = useState('');
  const openDapp = () => { location.hash = 'diamond'; };
  async function copyAddress() { try { await navigator.clipboard.writeText(JACK); setCopyMessage('Copied!'); } catch { setCopyMessage('Select and copy the address above.'); } }
  useEffect(() => {
    const handleScroll = () => {
      const track = document.querySelector(`.${styles.rocketbunnyTrack}`);
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      if (rect.top < windowHeight && rect.bottom > 0) {
        const progress = 1 - rect.top / windowHeight;
        const clamped = Math.max(0, Math.min(progress, 1));
        setScrollX(clamped * 100);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

const legend = 'When the storms hit — rug pulls, FUD, and depegged dreams — most ran, but not Jack Rabbit. With his shades on and conviction in his heart, he stood firm. That resilience became legend — and from it, JACK was born. Built on PulseChain, JACK brings staking, farming, mining and vesting bonds into one community-powered ecosystem. The mission is to build dedicated reserves toward pDAI support, with funded rewards and no guaranteed peg.';
const [typed, setTyped] = useState('');
useEffect(() => {
  let timer;
  const box = document.getElementById('typingBox');
  if (!box) return;
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setTyped(legend); return; }
    let index = 0;
    timer = setInterval(() => { index++; setTyped(legend.slice(0, index)); if (index >= legend.length) clearInterval(timer); }, 25);
  });
  observer.observe(box);
  return () => { observer.disconnect(); clearInterval(timer); };
}, []);



  return (
    <div className={styles.app}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.itemLeft}>
          <img
            src={jacklogo}
            alt="Jack Rabbit Logo"
            className={styles.topBarLogo}
          />
        </div>
        <div className={styles.itemRight}>
          <button
            className={styles.walletButton}
            onClick={openDapp}>
            Dapp
          </button>
        </div>
      </div>

      {/* Main Mascot */}
      <div className={styles.mainSection}>
  <div className={styles.images}>
    <img
      src={catchme}
      alt="JackRabbit slogan"
      className={styles.catchmeImg}
    />

    <div className={styles.mascotWrapper}>
      <img
        src={jacklaughing}
        alt="JackRabbit gif"
        className={styles.mascotImg}
      />
    </div>
  </div>

  <div className={styles.contractSection}>
    <label htmlFor="jack-address" className={styles.contractLabel}>Contract address</label>

    <div className={styles.contractInputWrapper}>
      <input
        id="jack-address"
        type="text"
        readOnly
        value={JACK}
        aria-label="JACK contract address"
        className={styles.contractInput}
      />
      <button className={styles.contractCopy} onClick={copyAddress} aria-label="Copy JACK contract address">📋</button>
    </div>

    <a className={styles.buyBtn} href={CHART} target="_blank" rel="noreferrer">View $Jack market ↗</a><span role="status" className={styles.copyStatus}>{copyMessage}</span>
  </div>
</div>


      {/* Animated Jack Banners */}
      <div className={`${styles.jackBanner} ${styles.leftBanner}`}>
        <div className={styles.scrollText}>
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={`left-${i}`} className={styles.jackWord}>
              $Jack
            </span>
          ))}
        </div>
      </div>
      <div className={`${styles.jackBanner} ${styles.rightBanner}`}>
        <div className={`${styles.scrollText} ${styles.reverse}`}>
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={`right-${i}`} className={styles.jackWord}>
              $Jack
            </span>
          ))}
        </div>
      </div>

      {/* Holder Message Section */}
      <div className={styles.holderMessage}>
  <div className={styles.holderLeft}>
    <div className={styles.headline}>Built for the Ones</div>
    <div className={styles.subhead}>Who Stayed</div>
    <div className={styles.holderBox}>
      <p>
        "Sometimes the loudest strength is quiet conviction. $JACK isn’t
        just a deflationary reward meme token — it’s a tip of the hat to
        those who didn’t sell, didn’t flinch, and didn’t forget what
        PulseChain and the pDAI ecosystem were meant to be. No promises,
        just proof."
      </p>
    </div>
  </div>

  <img
    src={sack}
    alt="Whitepaper sack"
    className={styles.sackImg}
  />
</div>


      {/* How Jack Runs Heading */}
      <div className={styles.howJackRuns}>
        <img
          src={howjackruns}
          alt="How Jack Runs!!!"
          className={styles.howJackRunsImg}
        />
      </div>

      {/* Animated Rocket Bunny */}
      <div className={styles.rocketbunnyTrack}>
      <img
        src={jackriding}
        alt="Jack Rocket Flying"
        className={styles.jackRocketAnimation}
        style={{
            /* set our CSS var here */
            '--jack-distance': `${scrollX}%`
        }}
        />
      </div>

      {/* Info Cards */}
      <div className={styles.infoCards}>
        <div className={`${styles.card} ${styles.firstCard}`}>
          <div className={`${styles.stack} ${styles.firstRedStack}`} />
          <div
            className={`${styles.stack} ${styles.firstYellowStack}`}
          />
          <p className={styles.firstCardParagraph}>
            💥 Don’t let your tokens sit still — stake the ones you already hold 🪙 and share funded JACK rewards.
            Your portfolio, now working for you.
          </p>
        </div>
        <div className={`${styles.card} ${styles.secondCard}`}>
          <div
            className={`${styles.stack} ${styles.secondYellowStack}`}
          />
          <div
            className={`${styles.stack} ${styles.secondWhiteStack}`}
          />
          <p className={styles.secondCardParagraph}>
            🤝 When funded pools launch, eligible LP tokens can earn JACK and paired-token rewards.
            Rewards depend on funding and participation.
          </p>
        </div>
        <div className={`${styles.card} ${styles.thirdCard}`}>
          <div
            className={`${styles.stack} ${styles.thirdWhiteStack}`}
          />
          <div className={`${styles.stack} ${styles.thirdRedStack}`} />
          <p className={styles.thirdCardParagraph}>
            🧠 JACK a growing ecosystem fueled by community action.
            Stay plugged in through our socials to catch every new feature and utility as it drops.
          </p>
        </div>
      </div>

      {/* Who Stayed Box */}
      <div className={styles.whoStayedContainer}>
        <div className={styles.whoStayedTitle}>
          THE LEGEND OF JACK RABBIT
        </div>
        <div className={styles.whoStayedBox} id="typingBox">
          <p id="typedText" className={styles.typingText}>
            <span id="typedContent">{typed}</span><span className={styles.cursor}>|</span>
          </p>
        </div>
      </div>

      {/* Tokenomics Section */}
      <div className={styles.tokenomicsSection}>
        <img
          src={tokenomics}
          alt="Tokenomics"
          className={styles.tokenomicsImg}
        />
        <div className={styles.tokenomicsVisuals}>
          <img
            src={richrabbit}
            alt="Rich Rabbit on Cloud"
            className={`${styles.richRabbitImg} ${styles.floatingRabbit}`}
          />
          <img
            src={chart}
            alt="Tokenomics Chart"
            className={styles.chartImg}
          />
        </div>
      </div>

      <p className={styles.artworkNote}>Original tokenomics concept artwork · not a record of deployed allocations.</p>

      {/* Join Us Section */}
      <div className={styles.joinUsSection}>
        <div className={styles.joinInner}>
          {/* Left side */}
          <div className={styles.joinLeft}>
            <img
              src={cashrabbit}
              alt="Cash Rabbit"
              className={styles.cashRabbitImg}
            />
          </div>
          {/* Right side */}
          <div className={styles.joinRight}>
            <img
              src={joinus}
              alt="Join Us"
              className={styles.joinusImg}
            />
            <div className={styles.socialIcons}>
              <img
                src={telegram}
                alt="Telegram"
                className={styles.socialIcon}
              />
              <img
                src={xlogo}
                alt="X Logo"
                className={styles.socialIcon}
              />
            </div>
          </div>
        </div>
        <div className={styles.joinDescriptionBox}>
          <p className={styles.joinDescription}>
            For those who held the line when everything fell — through the
            hacks, the noise, the silence — $JACK was made for you. A meme
            born from meaning. Stake what you stood for. Build what you
            deserve. Let the world chase what you never let go of…
          </p>
        </div>
      </div>
    </div>
  );
}



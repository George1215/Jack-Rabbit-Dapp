// src/pages/Landing.js
import React, { useEffect, useState } from 'react';
import styles from '../styles/Landing.module.css';
import { useNavigate } from 'react-router-dom';
import catchme from '../assets/catchme.png';
//import jackrabbit from '../assets/jackrabbit.png';
import jacklaughing from '../assets/jacklaughing.gif';
//import sack from '../assets/sack.png';
import richrabbit from '../assets/richrabbit.png';
import tokenomics from '../assets/tokenomics.png';
import chart from '../assets/chart.png';
import joinus from '../assets/joinus.png';
import telegram from '../assets/telegram.png';
import xlogo from '../assets/xlogo.png';
import cashrabbit from '../assets/cashrabbit.png';
import howjackruns from '../assets/howjackruns.png';
import jackriding from '../assets/Jackriding.png';
import jacklogo from '../assets/jacklogo.png';

export default function Landing() {
  const [scrollX, setScrollX] = useState(0);

  const navigate = useNavigate();           // ← new
  const openDapp = () => navigate('/diamond'); // ← now uses React Router
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

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

useEffect(() => {
  const paragraphs = [
    `When the storms hit — rug pulls, FUD, and depegged dreams — most ran, but not Jack Rabbit. With his shades on and conviction in his heart, he stood firm, While others panicked and fled, Jack simply watched, calm and unshaken. He didn’t sell nor did he flinch. That resilience became legend — and from it, JACK was born. But JACK isn’t just a meme tribute to diamond hands but rather an ecosystem designed to reward loyalty and ignite participation. Built on PulseChain, JACK flips the script: it’s deflationary, community-powered, and growing.`,
    `Upcoming Protocols like JackLP's and Jack NFTs are on the way — letting users earn JACK by providing liquidity or minting value-backed NFTs. Each of these fuels the Jack treasury and staking pools, creating a loop of value and utility. Soon, StakePad and JackSwap will give power to the people: custom staking pools and community-driven trading, built right in. This isn’t just another token chasing attention. It’s a movement. JACK is building a flywheel of value wrapped in meme energy — and it’s just getting started.`
  ];

  let current = 0, index = 0;
  const contentEl = document.getElementById("typedContent");

  function typeChar() {
    if (!contentEl) return;
    const currentParagraph = paragraphs[current];
    const char = currentParagraph.charAt(index);

    contentEl.textContent += char;
    index++;

    if (index < currentParagraph.length) {
      const delay = ['.', '!', '?'].includes(char) ? 1500 : 50;
      setTimeout(typeChar, delay);
    } else {
      setTimeout(() => {
        index = 0;
        contentEl.textContent = '';
        current = (current + 1) % paragraphs.length;
        typeChar();
      }, 5000);
    }
  }

  function triggerTypingOnceVisible() {
    const box = document.getElementById("typingBox");
    if (box && box.getBoundingClientRect().top < window.innerHeight) {
      window.removeEventListener("scroll", triggerTypingOnceVisible);
      typeChar();
    }
  }

  window.addEventListener("scroll", triggerTypingOnceVisible);
  return () => window.removeEventListener("scroll", triggerTypingOnceVisible);
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
    <label className={styles.contractLabel}>Contract address</label>

    <div className={styles.contractInputWrapper}>
      <input
        type="text"
        readOnly
        value="0xE004a1987fB0CAFAD49aA5180cbBb50c92e8C031"
        className={styles.contractInput}
      />
      <button className={styles.contractCopy}>📋</button>
    </div>

    <button className={styles.buyBtn}>Buy $Jack</button>
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
    src={require('../assets/sack.png')}
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
            💥 Don’t let your tokens sit still — stake the ones you already hold 🪙 and earn JACK every day.
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
            🤝 Pair JACK with tokens you believe in or stake your LP to earn more JACK passively.
            The stronger your bond, the greater your share.
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
            <span id="typedContent"></span><span className={styles.cursor}>|</span>
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
            born from meaning. Stake what you stood for. Mint what you
            deserve. Let the world chase what you never let go of…
          </p>
        </div>
      </div>
    </div>
  );
}


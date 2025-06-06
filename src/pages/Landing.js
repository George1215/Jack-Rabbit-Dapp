// src/pages/Landing.js
import React, { useEffect, useState } from 'react';
import styles from '../styles/Landing.module.css';
import { useNavigate } from 'react-router-dom';
import catchme from '../assets/catchme.png';
import jackrabbit from '../assets/jackrabbit.png';
import sack from '../assets/sack.png';
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
          <button className={styles.buyButton}>Buy $Jack</button>
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
              src={jackrabbit}
              alt="JackRabbit Mascot"
              className={styles.mascotImg}
            />
            <img
              src={sack}
              alt="Whitepaper Sacks"
              className={styles.sacksImg}
            />
          </div>
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
            Stake 🪙 RH tokens, pDAI and Atropa to earn $Jack for free
            continuously!!!
            <br /> 5% fee 💸 on every stake
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
            Stake 🪙 Jack to earn RH tokens, pDAI and Atropa for free
            continuously!!!
            <br /> 5% fee 💸 on every stake
          </p>
        </div>
        <div className={`${styles.card} ${styles.thirdCard}`}>
          <div
            className={`${styles.stack} ${styles.thirdWhiteStack}`}
          />
          <div className={`${styles.stack} ${styles.thirdRedStack}`} />
          <p className={styles.thirdCardParagraph}>
            Bond 🤝 (LP) Jack with pDAI, Atropa or any token of your choice
            to earn fees 💸 !!!
          </p>
        </div>
      </div>

      {/* Who Stayed Box */}
      <div className={styles.whoStayedContainer}>
        <div className={styles.whoStayedTitle}>
          THE LEGEND OF JACK RABBIT
        </div>
        <div className={styles.whoStayedBox}>
          <p>
            In a world of rug pulls, FUD storms, and depegged dreams, one
            rabbit stood tall — not with hype, but with conviction. While
            others panicked, Jack Rabbit held firm, sunglasses on, vibes
            unshaken. He didn’t sell. He didn’t flee. He just watched the
            chaos with quiet strength — and now, from that unwavering loyalty,
            $JACK was born. A deflationary reward meme token built not just
            to pump, but to honor those who stayed. The ones who believed in
            PulseChain when it was unpopular. The ones who knew pDAI would
            rise again. This isn’t just a meme — it’s a thank you. Stake RH
            tokens, pDAI or Atropa to earn $JACK. Stake JACK to earn those
            same assets back. Bond JACK with anything you love and earn
            fees. Every action feeds the system — and every 5% fee fuels the
            community. It’s a flywheel of value wrapped in meme energy. No
            more promises — just proof. We loop. We pump. We meme. We win.
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

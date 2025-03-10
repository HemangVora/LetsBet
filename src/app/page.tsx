"use client";
import { useEffect, useState, useRef } from "react";

import Image from "next/image";
import Link from "next/link";

import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { ethers } from "ethers";

import { styles } from "./components/styles";
// Add this interface near the top of your file, after your imports
interface Market {
  marketId: any;
  description: string;
  totalYesAmount: any;
  totalNoAmount: any;
  expirationDate: any;
  category: number;
  imageUrl: string;
}

// Add this interface after your Market interface
interface FormattedMarket {
  id: any;
  title: string;
  yesPercentage: number;
  noPercentage: number;
  liquidity: string;
  category: string;
  image: string;
  expirationDate: number;
}
export default function Main() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const scrollRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const rotation = useTransform(scrollYProgress, [0, 1], [0, 20]);
  const blur = useTransform(scrollYProgress, [0, 0.5], [0, 5]);

  // Light theme colors
  const colorScheme = { primary: "#000000", secondary: "#555555" };
  const [isHovering, setIsHovering] = useState(false);

  // Contract address and ABI
  const contractAddress = "0x8D92868b31d319A474c5227c39bd4CF9e46f7890";

  // Prediction markets state
  const [predictionMarkets, setPredictionMarkets] = useState<FormattedMarket[]>(
    []
  );

  const categories = [
    "All",
    "Memecoins",
    "NFTs",
    "Politics",
    "Social",
    "Gaming",
  ];
  const [activeCategory, setActiveCategory] = useState("All");

  // Custom Bee Loader Component
  const BeeLoader = () => {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-white bg-opacity-80">
        <motion.div
          className="relative"
          animate={{
            rotate: [0, 10, -10, 10, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <motion.div
            className="w-24 h-24 relative"
            animate={{
              y: [0, -15, 0],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/images/logo.png"
              alt="Bee Loading"
              fill
              className="object-contain rounded-full"
            />
          </motion.div>
          <motion.div
            className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-yellow-400 rounded-full opacity-30"
            animate={{
              width: [64, 48, 64],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
        <motion.p
          className="absolute mt-32 text-xl font-dmsans text-yellow-600"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          Buzzing in...
        </motion.p>
      </div>
    );
  };

  if (isLoading) {
    return <BeeLoader />;
  }

  return (
    <div className="min-h-screen text-black overflow-hidden bg-[#fff]">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b"
        style={{
          borderColor: "#ddd",
        }}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.div
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
          >
            <motion.div>
              <Image
                src="/images/logo.png"
                alt="Predikto Markets "
                width={60}
                height={60}
                className="mr-2 rounded-full"
              />
            </motion.div>
            <motion.h1 className="text-3xl font-bold font-dmsans">
              Predikto
            </motion.h1>
          </motion.div>
          <div className="flex items-center space-x-4">
            <button
              style={styles.boxShadowForButton}
              className={`w-[160px] h-[40px] ${styles.primaryButton} rounded-[32px] flex justify-center items-center`}
            >
              <p className="flex text-[16px] font-[600]">Login / Signup</p>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Category Filter */}
      <motion.section
        className="container mx-auto px-4 mb-8 "
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <div className="flex overflow-x-auto pb-2 scrollbar-hide relative">
          {/* Track indicator */}
          <motion.div className="absolute h-1 bottom-0 rounded-full bg-gray-300" />

          <div className="flex space-x-3">
            {categories.map((category) => (
              <button
                style={styles.boxShadowForButton}
                className={`w-[120px] h-[40px] ${styles.primaryButton} rounded-[32px] flex justify-center items-center`}
                onClick={() => setActiveCategory(category)}
                key={category}
              >
                <p className="flex text-[16px] font-[600]">{category}</p>
              </button>
              // <motion.button
              //   key={category}
              //   onClick={() => setActiveCategory(category)}
              //   className={`px-5 py-2 rounded-full whitespace-nowrap font-dmsans text-lg relative overflow-hidden`}
              //   style={{
              //     background:
              //       activeCategory === category
              //         ? `#f0f0f0`
              //         : `rgba(240, 240, 240, 0.5)`,
              //     border: `1px solid ${
              //       activeCategory === category ? "#999" : "#ccc"
              //     }`,
              //     color: activeCategory === category ? "#000" : "#555",
              //   }}
              //   whileHover={{ scale: 1.05 }}
              //   whileTap={{ scale: 0.95 }}
              // >
              //   <span className="relative z-10">{category}</span>
              // </motion.button>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Markets Grid */}
      <section className="container mx-auto px-4 pb-20">
        <motion.h3
          className="text-4xl font-bold mb-8 font-dmsans"
          initial={{ x: -100, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          Dankest Markets
        </motion.h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {predictionMarkets
              .filter(
                (market) =>
                  activeCategory === "All" || market.category === activeCategory
              )
              .map((market, index) => (
                <motion.div
                  key={market.id}
                  className="rounded-xl overflow-hidden relative"
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: index * 0.1,
                  }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02 }}
                  onHoverStart={() => setIsHovering(true)}
                  onHoverEnd={() => setIsHovering(false)}
                  style={{
                    background: `#fff`,
                    border: `1px solid #ddd`,
                  }}
                >
                  <div className="relative h-48 w-full overflow-hidden">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <img
                        src={market.image}
                        alt={market.title}
                        style={{ objectFit: "cover" }}
                        className="transition-transform duration-500"
                      />
                    </motion.div>
                    <motion.div className="absolute bottom-4 left-4">
                      <motion.span
                        className="px-4 py-2 rounded-full text-sm font-bold font-dmsans bg-gray-200"
                        whileHover={{ scale: 1.05 }}
                      >
                        {market.category}
                      </motion.span>
                    </motion.div>
                  </div>
                  <div className="p-6">
                    <motion.h4 className="text-xl font-bold mb-4 font-dmsans">
                      {market.title}
                    </motion.h4>

                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <motion.span
                          className="flex items-center"
                          whileHover={{ scale: 1.05 }}
                        >
                          <motion.div className="w-4 h-4 rounded-full mr-2 bg-black"></motion.div>
                          <span className="font-dmsans">
                            Based: {market.yesPercentage}%
                          </span>
                        </motion.span>
                        <motion.span
                          className="flex items-center"
                          whileHover={{ scale: 1.05 }}
                        >
                          <motion.div className="w-4 h-4 rounded-full mr-2 bg-gray-400"></motion.div>
                          <span className="font-dmsans">
                            Cringe: {market.noPercentage}%
                          </span>
                        </motion.span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <motion.div
                          className="h-4 bg-gray-400"
                          style={{
                            width: `${market.yesPercentage}%`,
                          }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${market.yesPercentage}%` }}
                          transition={{
                            duration: 1.5,
                            delay: 0.2,
                            type: "spring",
                            stiffness: 50,
                          }}
                          viewport={{ once: true }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <motion.span
                        className="text-sm flex items-center font-dmsans text-gray-600"
                        whileHover={{ scale: 1.05 }}
                      >
                        {market.liquidity}
                      </motion.span>
                      <Link href={`/market/${market.id}`}>
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {market.expirationDate}
                        </motion.div>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </section>

      {/* How It Works Section */}
      <motion.section
        className="py-16 relative overflow-hidden bg-white"
        style={{
          borderTop: `1px solid #ddd`,
          borderBottom: `1px solid #ddd`,
        }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="container mx-auto px-4 relative z-10">
          <motion.h3
            className="text-4xl font-bold text-center mb-12 font-dmsans"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            How To Get Rich
          </motion.h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                image: "/images/pepe-wallet.png",
                title: "Connect Wallet",
                desc: "Link your wallet and join the Pepe army",
              },
              {
                image: "/images/pepe-trade.png",
                title: "Pick Winners",
                desc: "Use your galaxy brain to predict the future",
              },
              {
                image: "/images/pepe-rich.png",
                title: "Get Rich",
                desc: "Stack them gains and flex on normies",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                className="flex flex-col items-center text-center p-8 rounded-2xl relative z-10"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.3,
                  type: "spring",
                }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.03 }}
                style={{
                  background: `#fff`,
                  border: `1px solid #ddd`,
                }}
              >
                <motion.div className="relative w-40 h-40 mb-8">
                  <Image src={item.image} alt={item.title} fill />
                </motion.div>
                <motion.h4 className="text-2xl font-bold mb-3 font-dmsans">
                  {item.title}
                </motion.h4>
                <motion.p className="text-lg font-dmsans text-gray-600">
                  {item.desc}
                </motion.p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer
        className="relative overflow-hidden py-12"
        style={{
          background: `#f8f8f8`,
          borderTop: `1px solid #ddd`,
        }}
      >
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center mb-10">
            <motion.div
              className="flex items-center mb-6 md:mb-0"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div className="rounded-full">
                <Image
                  src="/images/logo.png"
                  alt="Pepe Logo"
                  width={70}
                  height={70}
                  className="mr-3 rounded-full"
                />
              </motion.div>
              <motion.h1 className="text-3xl font-bold font-dmsans">
                Predikto
              </motion.h1>
            </motion.div>
            <div className="flex space-x-8">
              {[
                { icon: "/images/social/twitter.svg", alt: "Twitter" },
                { icon: "/images/social/telegram.svg", alt: "Telegram" },
                { icon: "/images/social/discord.svg", alt: "Discord" },
                { icon: "/images/social/github.svg", alt: "GitHub" },
              ].map((social, index) => (
                <motion.a
                  key={index}
                  href="#"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200">
                    <Image
                      src={social.icon}
                      alt={social.alt}
                      width={24}
                      height={24}
                    />
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
          <motion.div className="text-center mt-8 text-sm font-dmsans text-gray-500">
            <p>© 2024 Predikto Markets. </p>
          </motion.div>
        </div>
      </motion.footer>

      {/* Add globally required styles */}
    </div>
  );
}

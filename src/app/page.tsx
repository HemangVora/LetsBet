"use client";
import { useEffect, useState, useRef } from "react";

import Image from "next/image";
import Link from "next/link";

import { motion, useScroll, AnimatePresence } from "framer-motion";

import { styles } from "./components/styles";
import useGetAllMarket from "@/hooks/useGetAllMarket";
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
  description: string;
  end_time: string;
  id: string;
  outcome: number;
  question: string;
  status: number;
  total_no_amount: string;
  total_yes_amount: string;
}
export default function Main() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { scrollYProgress } = useScroll();
  const [isHovering, setIsHovering] = useState(false);
  const { markets, error, useGetAllMarketData } = useGetAllMarket();
  // Prediction markets state
  const [predictionMarkets, setPredictionMarkets] = useState<FormattedMarket[]>(
    []
  );
  useEffect(() => {
    const fetchMarkets = async () => {
      const markets = await useGetAllMarketData();
      setPredictionMarkets(markets);
    };
    fetchMarkets();
  }, []);
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
        className=" fixed top-0 z-50 backdrop-blur-2xl w-full bg-transparent border-b"
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
                src="/logo.png"
                alt="Predikto Markets "
                width={60}
                height={60}
                className="mr-2 rounded-full"
              />
            </motion.div>
            <motion.h1 className="text-3xl font-bold font-dmsans text-[#574624]">
              Predikto
            </motion.h1>
          </motion.div>
          <div className="flex items-center space-x-4">
            <button
              style={styles.boxShadowForButton}
              className={`w-[160px] h-[40px] ${styles.primaryButton} rounded-[32px] flex justify-center items-center`}
            >
              <p className="flex text-[16px] font-[600]">Get started</p>
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

          <div className="flex space-x-3 mt-32">
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
          Markets
        </motion.h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {predictionMarkets
              .filter((market) => activeCategory === "All")
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
                  <div className="relative  w-full overflow-hidden">
                    {/* <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <img
                        src={market.image}
                        alt={market.title}
                        style={{ objectFit: "cover" }}
                        className="transition-transform duration-500"
                      />
                    </motion.div> */}
                    <motion.div className="absolute bottom-4 left-4">
                      {/* <motion.span
                        className="px-4 py-2 rounded-full text-sm font-bold font-dmsans bg-gray-200"
                        whileHover={{ scale: 1.05 }}
                      >
                        {market.category}
                      </motion.span> */}
                    </motion.div>
                  </div>
                  <div className="p-6">
                    <motion.h4 className="text-xl font-bold mb-4 font-dmsans">
                      {market.question}
                    </motion.h4>

                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <motion.span
                          className="flex items-center"
                          whileHover={{ scale: 1.05 }}
                        >
                          <motion.div className="w-4 h-4 rounded-full mr-2 bg-[#574624]"></motion.div>
                          <span className="font-dmsans">
                            Based:{" "}
                            {(
                              parseInt(market.total_yes_amount) / 100000000
                            ).toFixed(2)}{" "}
                            APT
                          </span>
                        </motion.span>
                        <motion.span
                          className="flex items-center"
                          whileHover={{ scale: 1.05 }}
                        >
                          <motion.div className="w-4 h-4 rounded-full mr-2 bg-gray-400"></motion.div>
                          <span className="font-dmsans">
                            Cringe:{" "}
                            {(
                              parseInt(market.total_no_amount) / 100000000
                            ).toFixed(2)}{" "}
                            APT
                          </span>
                        </motion.span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <motion.div
                          className="h-4 bg-gray-400"
                          style={{
                            width: `${
                              (parseInt(market.total_yes_amount) /
                                parseInt(market.total_no_amount)) *
                              100
                            }%`,
                          }}
                          initial={{ width: 0 }}
                          whileInView={{
                            width: `${
                              (parseInt(market.total_yes_amount) /
                                parseInt(market.total_no_amount)) *
                              100
                            }%`,
                          }}
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
                        {(
                          parseInt(market.total_yes_amount) / 100000000
                        ).toFixed(2)}{" "}
                      </motion.span>
                      <Link href={`/market/${market.id}`}>
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {new Date(
                            parseInt(market.end_time) * 1000
                          ).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
      ></motion.section>

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
                  src="/logo.png"
                  alt="Pepe Logo"
                  width={70}
                  height={70}
                  className="mr-3 rounded-full"
                />
              </motion.div>
              <motion.h1 className="text-3xl font-bold font-dmsans text-[#574624]">
                Predikto
              </motion.h1>
            </motion.div>
          </div>
          <motion.div className="text-center mt-8 text-sm font-dmsans text-gray-500">
            <p>© 2025 Predikto Markets. </p>
          </motion.div>
        </div>
      </motion.footer>

      {/* Add globally required styles */}
    </div>
  );
}

'use client';
import React, { useEffect, useState } from 'react';
import herobg from '@/public/heroBg.png';
import Image from 'next/image';
import { Dices, KeyRound } from 'lucide-react';
import { TypeAnimation } from 'react-type-animation';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { usePlayerContract } from '@/context/ContractProvider';

const HeroSection: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const { useIsRegistered, useGetUsername, registerPlayer } = usePlayerContract();

  const [gamerName, setGamerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [username, setUsername] = useState('');

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
    error: registeredError,
  } = useIsRegistered(address, { enabled: !!address });
  const { data: fetchedUsername } = useGetUsername(address, { enabled: !!address });

  useEffect(() => {
    if (registeredError) {
      console.error('Registered error:', registeredError);
      const msg = registeredError?.message || String(registeredError);
      setError(msg);
    }
    if (isUserRegistered) {
      setUsername(fetchedUsername || 'Unknown');
    } else {
      setUsername('');
    }
  }, [isUserRegistered, fetchedUsername, registeredError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGamerName(e.target.value);
  };

  const handleRouteToPrivateRoom = () => router.push('/game-settings');
  const handleRouteToJoinRoom = () => router.push('/join-room');

  const handleRequest = async () => {
    setError(null);
    setSuccess(null);

    if (!address) {
      setError('Please connect your wallet');
      return;
    }
    const name = gamerName.trim();
    if (!name) {
      setError('Please enter a username');
      return;
    }

    console.log('Calling registerPlayer with:', { name });
    setLoading(true);
    setRegistrationPending(true);

    try {
      await registerPlayer(name);
      setSuccess('Registration successful!');
      setGamerName('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Registration error:', err);
      const msg = err?.message || 'Failed to register. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
      setRegistrationPending(false);
    }
  };

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px]">Connecting to wallet...</p>
      </div>
    );
  }

  return (
    <section className="w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10">
      {/* Background */}
      <div className="w-full h-full overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      {/* Big title behind */}
      <div className="w-full h-auto absolute top-0 left-0 flex items-center justify-center">
        <h1 className="text-center uppercase font-kronaOne font-normal text-transparent big-hero-text w-full text-[40px] sm:text-[40px] md:text-[80px] lg:text-[135px] relative before:absolute before:content-[''] before:w-full before:h-full before:bg-gradient-to-b before:from-transparent lg:before:via-[#010F10]/80 before:to-[#010F10] before:top-0 before:left-0 before:z-10">
          BLOCKOPOLY
        </h1>
      </div>

      {/* Foreground content */}
      <main className="w-full h-full absolute top-0 left-0 z-20 bg-transparent flex flex-col lg:justify-center items-center gap-1">
        {/* Logged-in / pending / success messages */}
        {isUserRegistered && !registrationPending && !success && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Welcome back, {username}!
            </p>
          </div>
        )}
        {registrationPending && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Registering... Please wait.
            </p>
          </div>
        )}
        {success && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              {success}
            </p>
          </div>
        )}

        {/* Top animated tagline (Conquer / Build / Trade) */}
        <div className="flex justify-center items-center md:gap-6 gap-3 mt-4 md:mt-6 lg:mt-4">
          <TypeAnimation
            sequence={[
              'Conquer',
              1200,
              'Conquer • Build',
              1200,
              'Conquer • Build • Trade On',
              1800,
              'Conquer • Build',
              1000,
              'Conquer',
              1000,
              '',
              500,
            ]}
            wrapper="span"
            speed={40}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
        </div>

        {/* THE BLOCK heading */}
        <h1 className="block-text font-[900] font-orbitron lg:text-[116px] md:text-[98px] text-[54px] lg:leading-[120px] md:leading-[100px] leading-[60px] tracking-[-0.02em] uppercase text-[#17ffff] relative">
          THE BLOCK
          <span className="absolute top-0 left-[69%] text-[#0FF0FC] font-dmSans font-[700] md:text-[27px] text-[18px] rotate-12 animate-pulse">
            ?
          </span>
        </h1>

        {/* Bottom TypeAnimation */}
        <div className="w-full px-4 md:w-[70%] lg:w-[55%] text-center text-[#F0F7F7] -tracking-[2%]">
          <TypeAnimation
            sequence={[
              'Roll the dice 🎲',
              2000,
              'Buy properties 🏠',
              2000,
              'Collect rent 💰',
              2000,
              'Become the top tycoon 👑',
              2000,
            ]}
            wrapper="span"
            speed={50}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
        </div>

        {/* Registration / Buttons area */}
        <div className="w-full flex flex-col justify-center items-center mt-3 gap-3">
          {/* Show input + Let's Go only when wallet connected AND user NOT registered AND not pending */}
          {address && !isUserRegistered && !registrationPending && (
            <>
              <input
                type="text"
                name="name"
                id="name"
                value={gamerName}
                onChange={handleInputChange}
                required
                placeholder="input your name"
                className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans placeholder:text-[16px]"
              />

              <button
                type="button"
                className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                disabled={loading || !gamerName.trim() || !address}
                onClick={handleRequest}
              >
                <svg
                  width="260"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth={1}
                  />
                </svg>

                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] -tracking-[2%] font-orbitron font-[700] z-10">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      Registering...
                    </span>
                  ) : (
                    "Let's Go!"
                  )}
                </span>
              </button>
            </>
          )}

          {/* Show helpful message when wallet not connected */}
          {!address && (
            <p className="text-gray-400 text-sm text-center mt-2">
              Please connect your wallet to continue.
            </p>
          )}

          {/* Errors & success */}
          {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
          {!registrationPending && !isUserRegistered && success && (
            <p className="text-green-400 text-sm text-center mt-2">{success}</p>
          )}

          {/* If registered, show actions */}
          {address && isUserRegistered && (
            <div className="flex justify-center items-center mt-2 gap-4">
              <button
                type="button"
                onClick={handleRouteToJoinRoom}
                className="relative left-2 group w-[140px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              >
                <svg
                  width="140"
                  height="40"
                  viewBox="0 0 140 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full"
                >
                  <path
                    d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                    fill="#0E1415"
                    stroke="#003B3E"
                    strokeWidth={1}
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-10">
                  <Dices className="mr-1.5 w-[16px] h-[16px]" />
                  Join Room
                </span>
              </button>

              <button
                type="button"
                onClick={handleRouteToPrivateRoom}
                className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              >
                <svg
                  width="227"
                  height="40"
                  viewBox="0 0 227 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
                >
                  <path
                    d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                    fill="#003B3E"
                    stroke="#003B3E"
                    strokeWidth={1}
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-10">
                  <KeyRound className="mr-1.5 w-[16px] h-[16px]" />
                  Create A Private Game
                </span>
              </button>
            </div>
          )}
        </div>
      </main>
    </section>
  );
};

export default HeroSection;
-- ===================================================================
-- TITLE : PERIDOT sample project
--         Arm robot Contoller
--
--   DEGISN : S.OSAFUNE (J-7SYSTEM Works)
--   DATE   : 2014/08/30 -> 2014/08/30
--   UPDATE : 
--
-- ===================================================================
-- *******************************************************************
--   Copyright (C) 2013, J-7SYSTEM Works.  All rights Reserved.
--
-- * This module is a free sourcecode and there is NO WARRANTY.
-- * No restriction on use. You can use, modify and redistribute it
--   for personal, non-profit or commercial products UNDER YOUR
--   RESPONSIBILITY.
-- * Redistributions of source code must retain the above copyright
--   notice.
-- *******************************************************************


library IEEE;
use IEEE.std_logic_1164.all;
use IEEE.std_logic_arith.all;
use IEEE.std_logic_unsigned.all;

entity sample_armrobot_top is
	port(
		CLOCK_50	: in  std_logic;
		RESET_N		: in  std_logic;
		START_LED	: out std_logic;

		SCI_SCLK	: in  std_logic;
		SCI_TXD		: in  std_logic;
		SCI_RXD		: out std_logic;
		SCI_TXR_N	: out std_logic;
		SCI_RXR_N	: in  std_logic;

		D			: inout std_logic_vector(27 downto 0)
	);
end sample_armrobot_top;

architecture RTL of sample_armrobot_top is

	signal reset_sig		: std_logic;
	signal pwmled_sig		: std_logic_vector(7 downto 0);
	signal motor_ch1_sig	: std_logic_vector(9 downto 0);
	signal motor_ch2_sig	: std_logic_vector(9 downto 0);
	signal motor_ch3_sig	: std_logic_vector(9 downto 0);
	signal motor_ch4_sig	: std_logic_vector(9 downto 0);
	signal motor_ch5_sig	: std_logic_vector(9 downto 0);
	signal vset_ch1_sig		: std_logic;
	signal vset_ch2_sig		: std_logic;
	signal vset_ch3_sig		: std_logic;
	signal vset_ch4_sig		: std_logic;
	signal vset_ch5_sig		: std_logic;
	signal vset_led_sig		: std_logic;


    component motor_controller_core is
        port (
            clk_clk          : in  std_logic                    := 'X'; -- clk
            reset_reset_n    : in  std_logic                    := 'X'; -- reset_n
            sci_sclk         : in  std_logic                    := 'X'; -- sclk
            sci_txd          : in  std_logic                    := 'X'; -- txd
            sci_txr_n        : out std_logic;                           -- txr_n
            sci_rxd          : out std_logic;                           -- rxd
            sci_rxr_n        : in  std_logic                    := 'X'; -- rxr_n
            motor_ch1_export : out std_logic_vector(9 downto 0);        -- export
            motor_ch2_export : out std_logic_vector(9 downto 0);        -- export
            motor_ch3_export : out std_logic_vector(9 downto 0);        -- export
            motor_ch4_export : out std_logic_vector(9 downto 0);        -- export
            motor_ch5_export : out std_logic_vector(9 downto 0);        -- export
            pwmled_export    : out std_logic_vector(7 downto 0);        -- export
            sysled_export    : out std_logic                            -- export
        );
    end component motor_controller_core;

	component pwm_encoder is
	generic(
		BITWIDTH : integer := 8
	);
	port(
		clk		: in  std_logic;
		reset	: in  std_logic;
		data	: in  std_logic_vector(BITWIDTH-1 downto  0);
		pwm		: out std_logic
	);
	end component;

	component dsm_encoder is
	generic(
		BITWIDTH	: integer := 12
	);
	port(
		clk			: in  std_logic;
		reset		: in  std_logic;
		data_in		: in  std_logic_vector(BITWIDTH-1 downto 0);
		dsm_out		: out std_logic
	);
	end component;

begin

	reset_sig <= not RESET_N;


	----------------------------------------------
	-- Peridot Interface 
	----------------------------------------------

    u0 : motor_controller_core
        port map (
            clk_clk          => CLOCK_50,
            reset_reset_n    => RESET_N,
            sci_sclk         => SCI_SCLK,
            sci_txd          => SCI_TXD,
            sci_txr_n        => SCI_TXR_N,
            sci_rxd          => SCI_RXD,
            sci_rxr_n        => SCI_RXR_N,
            motor_ch1_export => motor_ch1_sig,
            motor_ch2_export => motor_ch2_sig,
            motor_ch3_export => motor_ch3_sig,
            motor_ch4_export => motor_ch4_sig,
            motor_ch5_export => motor_ch5_sig,
            pwmled_export    => pwmled_sig,
            sysled_export    => START_LED
        );


	----------------------------------------------
	-- PWM Encoder
	----------------------------------------------

	pwmch1 : dsm_encoder
	generic map (
		BITWIDTH => 10
	)
	port map (
		clk		=> CLOCK_50,
		reset	=> reset_sig,
		data_in	=> (motor_ch1_sig(7 downto 0) & "00"),
		dsm_out	=> vset_ch1_sig
	);

	pwmch2 : dsm_encoder
	generic map (
		BITWIDTH => 10
	)
	port map (
		clk		=> CLOCK_50,
		reset	=> reset_sig,
		data_in	=> (motor_ch2_sig(7 downto 0) & "00"),
		dsm_out	=> vset_ch2_sig
	);

	pwmch3 : dsm_encoder
	generic map (
		BITWIDTH => 10
	)
	port map (
		clk		=> CLOCK_50,
		reset	=> reset_sig,
		data_in	=> (motor_ch3_sig(7 downto 0) & "00"),
		dsm_out	=> vset_ch3_sig
	);

	pwmch4 : dsm_encoder
	generic map (
		BITWIDTH => 10
	)
	port map (
		clk		=> CLOCK_50,
		reset	=> reset_sig,
		data_in	=> (motor_ch4_sig(7 downto 0) & "00"),
		dsm_out	=> vset_ch4_sig
	);

	pwmch5 : dsm_encoder
	generic map (
		BITWIDTH => 10
	)
	port map (
		clk		=> CLOCK_50,
		reset	=> reset_sig,
		data_in	=> (motor_ch5_sig(7 downto 0) & "00"),
		dsm_out	=> vset_ch5_sig
	);


	pwmled : pwm_encoder
	generic map (
		BITWIDTH => 8
	)
	port map (
		clk		=> CLOCK_50,
		reset	=> reset_sig,
		data	=> pwmled_sig,
		pwm		=> vset_led_sig
	);


	----------------------------------------------
	-- Pin assign
	----------------------------------------------

	D(0) <= motor_ch1_sig(8);		-- CH1 IN1
	D(1) <= motor_ch1_sig(9);		-- CH1 IN2
	D(10) <= vset_ch1_sig;			-- CH1 VSET

	D(2) <= motor_ch2_sig(8);		-- CH2 IN1
	D(3) <= motor_ch2_sig(9);		-- CH2 IN2
	D(11) <= vset_ch2_sig;			-- CH2 VSET

	D(4) <= motor_ch3_sig(8);		-- CH3 IN1
	D(5) <= motor_ch3_sig(9);		-- CH3 IN2
	D(12) <= vset_ch3_sig;			-- CH3 VSET

	D(6) <= motor_ch4_sig(8);		-- CH4 IN1
	D(7) <= motor_ch4_sig(9);		-- CH4 IN2
	D(13) <= vset_ch4_sig;			-- CH4 VSET

	D(8) <= motor_ch5_sig(8);		-- CH5 IN1
	D(9) <= motor_ch5_sig(9);		-- CH5 IN2
	D(14) <= vset_ch5_sig;			-- CH5 VSET

	D(21) <= not vset_led_sig;		-- LED


end RTL;



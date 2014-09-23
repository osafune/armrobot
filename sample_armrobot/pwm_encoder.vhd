-- ===================================================================
-- TITLE : PWM output
--
--   DEGISN : S.OSAFUNE (J-7SYSTEM Works)
--   DATE   : 2013/11/07 -> 2013/11/07
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

entity pwm_encoder is
	generic(
		BITWIDTH : integer := 8
	);
	port(
		clk		: in  std_logic;
		reset	: in  std_logic;
		data	: in  std_logic_vector(BITWIDTH-1 downto  0);

		pwm		: out std_logic
	);
end pwm_encoder;

architecture RTL of pwm_encoder is
	constant PWMCOUNTER_MAX	: integer := 2**BITWIDTH-1;

	signal pwmdata_sig		: std_logic_vector(data'length-1 downto 0);
	signal pwmcounter_reg	: std_logic_vector(data'length-1 downto 0);
	signal pwmout_reg		: std_logic;

begin

	pwmdata_sig <= data;

	process (clk, reset) begin
		if (reset = '1') then
			pwmcounter_reg <= (others=>'0');
			pwmout_reg <= '0';

		elsif (clk'event and clk = '1') then
			pwmcounter_reg <= pwmcounter_reg + 1;

			if (pwmcounter_reg = PWMCOUNTER_MAX) then
				pwmout_reg <= '1';
			elsif (pwmcounter_reg = pwmdata_sig) then
				pwmout_reg <= '0';
			end if;

		end if;
	end process;

	pwm <= pwmout_reg;


end RTL;

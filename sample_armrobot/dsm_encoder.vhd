-- ===================================================================
-- TITLE : Delta-Sigma DAC output
--
--   DEGISN : S.OSAFUNE (J-7SYSTEM Works)
--   DATE   : 2007/02/18 -> 2007/02/18
--   UPDATE : 2014/08/30
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
use IEEE.std_logic_unsigned.all;
use IEEE.std_logic_arith.all;

entity dsm_encoder is
	generic(
		BITWIDTH		: integer := 12
	);
	port(
		clk			: in  std_logic;
		reset		: in  std_logic;
		data_in		: in  std_logic_vector(BITWIDTH-1 downto 0);
		dsm_out		: out std_logic
	);
end dsm_encoder;

architecture RTL of dsm_encoder is

	signal pcm_sig		: std_logic_vector(BITWIDTH-1 downto 0);
	signal add_sig		: std_logic_vector(BITWIDTH downto 0);
	signal dse_reg		: std_logic_vector(BITWIDTH-1 downto 0);
	signal dacout_reg	: std_logic;

begin

	pcm_sig <= data_in;

	add_sig <= ('0' & pcm_sig) + ('0' & dse_reg);

	process(clk, reset)begin
		if (reset = '1') then
			dse_reg    <= (others=>'0');
			dacout_reg <= '0';

		elsif (clk'event and clk = '1') then
			dse_reg    <= add_sig(add_sig'left-1 downto 0);
			dacout_reg <= add_sig(add_sig'left);

		end if;
	end process;

	dsm_out <= dacout_reg;


end RTL;

// ===================================================================
// TITLE : PERIDOT / AvalonST bytes to SCIF
//
//   DEGISN : S.OSAFUNE (J-7SYSTEM Works)
//   DATE   : 2013/10/10 -> 2013/10/11
//   UPDATE : 
//
// ===================================================================
// *******************************************************************
//   Copyright (C) 2013, J-7SYSTEM Works.  All rights Reserved.
//
// * This module is a free sourcecode and there is NO WARRANTY.
// * No restriction on use. You can use, modify and redistribute it
//   for personal, non-profit or commercial products UNDER YOUR
//   RESPONSIBILITY.
// * Redistributions of source code must retain the above copyright
//   notice.
// *******************************************************************

module peridot_bytes_to_scif(
	output [1:0]	test_infifo_usedw_sig,


	// Interface: clk
	input			clk,
	input			reset,

	// Interface: ST out 
	input			out_ready,
	output			out_valid,
	output [7:0]	out_data,

	// Interface: ST in 
	output			in_ready,
	input			in_valid,
	input  [7:0]	in_data,

	// External Physicaloid Serial Interface 
	input			scif_sclk,
	input			scif_txd,
	output			scif_txr_n,
	output			scif_rxd,
	input			scif_rxr_n
);


/* ===== �O���ύX�\�p�����[�^ ========== */



/* ----- �����p�����[�^ ------------------ */



/* ���ȍ~�̃p�����[�^�錾�͋֎~�� */

/* ===== �m�[�h�錾 ====================== */
				/* �����͑S�Đ��_�����Z�b�g�Ƃ���B�����Œ�`���Ă��Ȃ��m�[�h�̎g�p�͋֎~ */
	wire			reset_sig = reset;				// ���W���[�������쓮�񓯊����Z�b�g 

				/* �����͑S�Đ��G�b�W�쓮�Ƃ���B�����Œ�`���Ă��Ȃ��N���b�N�m�[�h�̎g�p�͋֎~ */
	wire			clock_sig = clk;				// ���W���[�������쓮�N���b�N 
	wire			scif_clock_sig = scif_sclk;		// SCIF�V���A���N���b�N 

	reg				sciftxr_reg;
	reg  [3:0]		sciftxcounter_reg;
	reg  [9:0]		sciftxdin_reg;
	reg				sciftxbusy_reg;
	wire			sciftxd_sig;
	wire [7:0]		infifo_data_sig;
	wire			infifo_wrreq_sig;
	wire [1:0]		infifo_usedw_sig;
	wire [7:0]		infifo_q_sig;
	wire			infifo_rdack_sig;
	wire			infifo_empty_sig;
	wire			outready_sig;

	reg				scifrxr_reg;
	reg				scifrxready_reg;
	reg  [3:0]		scifrxcounter_reg;
	reg  [8:0]		scifrxdout_reg;
	reg  [2:0]		scifrxreq_in_reg;
	reg  [7:0]		scifrxdata_reg;
	reg				scifrxstart_reg;
	reg				scifrxdone_reg;
	wire			scifrxr_sig;
	wire			scifrxreq_sig;
	wire [7:0]		scifrxdata_in_sig;
	wire			scifrxdata_latch_sig;
	reg  [1:0]		rxdatadone_in_reg;
	reg				rxdatareq_reg;
	reg  [7:0]		rxdata_reg;
	wire			rxdatadone_sig;
	wire			inready_sig;
	wire			invalid_sig;
	wire [7:0]		indata_sig;


/* ���ȍ~��wire�Areg�錾�͋֎~�� */

/* ===== �e�X�g�L�q ============== */

	assign test_infifo_usedw_sig = infifo_usedw_sig;


/* ===== ���W���[���\���L�q ============== */

	assign outready_sig = out_ready;
	assign out_valid = ~infifo_empty_sig;
	assign out_data = infifo_q_sig;

	assign in_ready = inready_sig;
	assign invalid_sig = in_valid;
	assign indata_sig = in_data;

	assign sciftxd_sig = scif_txd;
	assign scif_txr_n = ~sciftxr_reg;

	assign scif_rxd = scifrxdout_reg[0];
	assign scifrxr_sig = ~scif_rxr_n;


	///// SCIF_TXD �� AvalonST�o�C�g�X�g���[�� /////

	// TXR�M�����M 

	always @(negedge scif_clock_sig or posedge reset_sig) begin
		if (reset_sig) begin
			sciftxr_reg <= 1'b0;
		end
		else begin
			sciftxr_reg <= ~sciftxbusy_reg;
		end
	end


	// TXD�f�V���A���C�U 

	always @(posedge scif_clock_sig or posedge reset_sig) begin
		if (reset_sig) begin
			sciftxcounter_reg <= 4'd0;
			sciftxdin_reg <= {10{1'b1}};
			sciftxbusy_reg <= 1'b0;
		end
		else begin
			sciftxdin_reg <= {sciftxd_sig, sciftxdin_reg[9:1]};

			if (sciftxcounter_reg == 4'd0) begin			// ��M�J�E���^ 
				if (sciftxdin_reg[9] == 1'b0) begin
					sciftxcounter_reg <= 4'd1;
				end
			end
			else begin
				if (sciftxcounter_reg == 4'd9) begin
					sciftxcounter_reg <= 4'd0;
				end
				else begin
					sciftxcounter_reg <= sciftxcounter_reg + 1'd1;
				end
			end

			if (infifo_usedw_sig >= 2'd2) begin
				sciftxbusy_reg <= 1'b1;
			end
			else begin
				sciftxbusy_reg <= 1'b0;
			end
		end
	end


	// �N���b�N�h���C���u���b�WFIFO 

	assign infifo_data_sig = sciftxdin_reg[8:1];
	assign infifo_wrreq_sig = (sciftxcounter_reg == 4'd9);
	assign infifo_rdack_sig = (!infifo_empty_sig && outready_sig)? 1'b1 : 1'b0;

	peridot_scif_infifo
	inst_infifo (
		.aclr		(reset_sig),

		.wrclk		(scif_clock_sig),
		.wrreq		(infifo_wrreq_sig),
		.data		(infifo_data_sig),
		.wrusedw	(infifo_usedw_sig),

		.rdclk		(clock_sig),
		.rdempty	(infifo_empty_sig),
		.q			(infifo_q_sig),
		.rdreq		(infifo_rdack_sig)
	);



	///// AvalonST�o�C�g�X�g���[�� �� SCIF_RXD /////

	// AvalonST-Sink���� 

	assign inready_sig = (!rxdatadone_in_reg[1] && !rxdatareq_reg && invalid_sig)? 1'b1 : 1'b0;
	assign rxdatadone_sig = scifrxdone_reg;

	always @(posedge clock_sig or posedge reset_sig) begin
		if (reset_sig) begin
			rxdatareq_reg <= 1'b0;
			rxdatadone_in_reg <= 2'b00;
		end
		else begin
			rxdatadone_in_reg <= {rxdatadone_in_reg[0], rxdatadone_sig};

			if (!rxdatadone_in_reg[1] && !rxdatareq_reg && invalid_sig) begin
				rxdatareq_reg <= 1'b1;
				rxdata_reg <= indata_sig;
			end
			else if (rxdatareq_reg && rxdatadone_in_reg[1]) begin
				rxdatareq_reg <= 1'b0;
			end

		end
	end


	// RXR�M����M 

	always @(posedge scif_clock_sig or posedge reset_sig) begin
		if (reset_sig) begin
			scifrxr_reg <= 1'b0;
		end
		else begin
			scifrxr_reg <= scifrxr_sig;
		end
	end


	// RXD�V���A���C�U 

	assign scifrxreq_sig = rxdatareq_reg;
	assign scifrxdata_in_sig = rxdata_reg;
	assign scifrxdata_latch_sig = (!scifrxreq_in_reg[2] && scifrxreq_in_reg[1]);

	always @(negedge scif_clock_sig or posedge reset_sig) begin
		if (reset_sig) begin
			scifrxreq_in_reg <= 3'b000;
			scifrxstart_reg <= 1'b0;
			scifrxdone_reg <= 1'b0;
			scifrxready_reg <= 1'b0;
			scifrxcounter_reg <= 4'd0;
			scifrxdout_reg <= {9{1'b1}};
		end
		else begin
			scifrxready_reg <= scifrxr_reg;
			scifrxreq_in_reg <= {scifrxreq_in_reg[1:0], scifrxreq_sig};

			if (scifrxdata_latch_sig) begin					// RXD�f�[�^�̃��b�` 
				scifrxdata_reg <= scifrxdata_in_sig;
			end

			if (scifrxdata_latch_sig) begin
				scifrxstart_reg <= 1'b1;
			end
			else if (scifrxcounter_reg == 4'd1) begin
				scifrxstart_reg <= 1'b0;
			end

			if (scifrxcounter_reg == 4'd1) begin			// RXD�f�[�^���M�J�n 
				scifrxdone_reg <= 1'b1;
			end
			else if (scifrxdone_reg && !scifrxreq_in_reg[1]) begin
				scifrxdone_reg <= 1'b0;
			end

			if (scifrxcounter_reg == 4'd0) begin			// RXD�f�[�^�𑗐M 
				if (scifrxstart_reg && scifrxready_reg) begin
					scifrxcounter_reg <= 4'd1;
					scifrxdout_reg <= {scifrxdata_reg, 1'b0};
				end
			end
			else if (scifrxcounter_reg == 4'd9) begin
				scifrxcounter_reg <= 4'd0;
				scifrxdout_reg <= {9{1'b1}};
			end
			else begin
				scifrxcounter_reg <= scifrxcounter_reg + 1'd1;
				scifrxdout_reg <= {1'b1, scifrxdout_reg[8:1]};
			end
		end
	end


endmodule

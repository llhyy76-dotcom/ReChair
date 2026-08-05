from core.pdf_parser import _parse_nc_order_confirmation_text


def test_nc1911_like_text():
    text = """
    ORDER CONFIRMATION
    ORDER NO. 1911 DATE 19 4 9
    SUPPLIER NINGBO BEYOND ELECTRONIC TECHNOLOGY CO., LTD.
    MODEL Q'TY PRICE AMOUNT REMARKS
    Main board PCB, NL500 50 PCS U$ 26.00 U$ 1,300.00
    Remocon with cable, NL500 30 PCS U$ 25.00 U$ 750.00
    PU cover, shoulder L, NL500 40 PCS U$ 6.00 U$ 240.00
    Pad, back, NL500 40 PCS U$ 30.00 U$ 1,200.00
    TOTAL 610 PCS U$ 7,480.00
    """
    rows, total_qty, total_amount = _parse_nc_order_confirmation_text(text)
    assert len(rows) == 4
    assert rows[0].part_name_en == "Main board PCB, NL500"
    assert rows[0].model == "NL500"
    assert rows[0].qty == 50
    assert rows[0].price == 26
    assert rows[0].amount == 1300
    assert total_qty == 610
    assert total_amount == 7480


def test_nc1930_multiline_description():
    text = """
    MODEL Q'TY PRICE AMOUNT REMARKS
    Inner Cloth Cover, Backrest, 710
    (Request with thin zipper) 100 PCS U$ 7.00 U$ 700.00
    Remocon with Cable, 752 20 PCS U$ 24.00 U$ 480.00
    TOTAL 640 PCS U$ 7,170.00
    """
    rows, total_qty, total_amount = _parse_nc_order_confirmation_text(text)
    assert len(rows) == 2
    assert "thin zipper" in rows[0].part_name_en
    assert rows[0].model == "710"
    assert rows[1].model == "752"
    assert total_qty == 640
    assert total_amount == 7170


def test_header_is_never_accepted_as_part():
    text = """
    ORDER NO. : 1930 DATE : 19 5 28
    SUPPLIER : NINGBO BEYOND ELECTRONIC TECHNOLOGY CO., LTD.
    MODEL Q'TY PRICE AMOUNT REMARKS
    ORDER NO. : 1930 DATE : 19 5 28
    Pad, Back, BE, 885 30 PCS U$ 30.00 U$ 900.00
    TOTAL 30 PCS U$ 900.00
    """
    rows, _, _ = _parse_nc_order_confirmation_text(text)
    assert len(rows) == 1
    assert rows[0].part_name_en == "Pad, Back, BE, 885"


def test_invalid_amount_row_is_excluded():
    text = """
    MODEL Q'TY PRICE AMOUNT
    Pad, Back, 885 30 PCS 30.00 90.00
    TOTAL 30 PCS 90.00
    """
    rows, _, _ = _parse_nc_order_confirmation_text(text)
    assert rows == []

import pytest
import pandas as pd
import numpy as np
from engine.timing import TimingEngine

def test_burst_detection():
    # Create a synthetic dataframe with a clear burst
    data = {
        'from': ['0x1'] * 10,
        'to': ['0x2', '0x3', '0x4', '0x5', '0x6', '0x7', '0x8', '0x9', '0x10', '0x11'],
        'amount_eth': [1.0] * 10,
        'timestamp': [100, 105, 110, 115, 500, 510, 520, 530, 1000, 1010], # Two bursts
        'chain': ['eth'] * 10
    }
    df = pd.DataFrame(data)
    engine = TimingEngine(df)

    bursts = engine.detect_bursts('0x1')
    assert len(bursts) == 3
    assert bursts[0]['count'] == 4
    assert bursts[1]['count'] == 4

def test_bot_fingerprint():
    # Low CV = Bot
    bot_data = {'from': ['0x1']*10, 'timestamp': [100, 110, 120, 130, 140, 150, 160, 170, 180, 190], 'chain': ['eth']*10}
    # High CV = Noise
    noise_data = {'from': ['0x2']*10, 'timestamp': [100, 500, 1000, 1100, 5000, 6000, 10000, 11000, 12000, 20000], 'chain': ['eth']*10}

    df = pd.concat([pd.DataFrame(bot_data), pd.DataFrame(noise_data)])
    engine = TimingEngine(df)

    bot_res = engine.analyze_bot_fingerprint('0x1')
    noise_res = engine.analyze_bot_fingerprint('0x2')

    assert bot_res['is_bot'] == True
    assert noise_res['is_bot'] == False

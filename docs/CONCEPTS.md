# Blockchain Concepts for Beginners

This document explains the terminology used in this project in plain English.

## Basic Terms
- **Wallet Address**: A unique string (starting with `0x`) that acts like a bank account number.
- **Transaction**: A record of funds moving from one wallet address to another.
- **Chain**: The network the transaction happened on (e.g., Ethereum, Solana).

## Attacker Patterns (The "Laundering" Process)
- **Drain Wallet**: The first wallet that receives the stolen funds.
- **Fan-Out (Hubs)**: To avoid detection, attackers don't keep money in one place. They send large amounts to a few "Hub" wallets, which then split the money into hundreds of "Leaf" wallets.
- **Peel Chain**: A technique where a wallet sends a small amount to an exchange and the rest to a new wallet, "peeling" off layers of money.
- **Gas Funding**: To send money, a wallet needs a tiny bit of ETH to pay for the transaction (called "Gas"). Attackers often use one "Gas Funder" wallet to seed all their hub and leaf wallets.
- **Bridges**: Services that move money from one blockchain (Ethereum) to another (Solana). This "breaks" the simple paper trail.
- **Mixers**: Services that pool money from many users and spit it out in random amounts to hide the original source.

## Forensic Techniques
- **Taint Analysis**: Marking every wallet that receives money from the original stolen pool as "tainted."
- **Time-Delta Latency**: Looking for a pattern where a social media post happens exactly $X$ seconds before a blockchain transaction.
- **Cluster Detection**: Using math to group wallets that behave exactly the same way, suggesting they are owned by the same person.

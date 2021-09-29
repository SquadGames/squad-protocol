import React, { useState } from 'react'
import logo from './logo.svg'
import './App.css'
import axios from 'axios'

import { ContentPage } from './content'

import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
} from "@apollo/client"

import { MetaMaskProvider } from "metamask-react"

import { Web3ApiProvider } from '@web3api/react'
import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ensPlugin } from "@web3api/ens-plugin-js"
import { graphNodePlugin } from '@web3api/graph-node-plugin-js'
import { PluginPackage } from '@web3api/client-js'

const apolloClient = new ApolloClient({
  uri: 'http://localhost:8000/subgraphs/name/squadgames/squad-POC-subgraph',
  cache: new InMemoryCache()
})

async function getPolywrapPlugins(signer: number = 0) {
  // fetch providers from dev server
  return [
    {
      uri: "/ens/ens.web3api.eth",
      plugin: ensPlugin({
        addresses: {
          testnet: "0x630589690929E9cdEFDeF0734717a9eF3Ec7Fcfe"
        }
      })
    },
    {
      uri: "/ens/ethereum.web3api.eth",
      plugin: ethereumPlugin({
        networks: {
          testnet: {
            provider: "http://localhost:8545",
            signer: signer
          }
        },
        // If defaultNetwork is not specified, mainnet will be used.
        defaultNetwork: "testnet"
      })
    },
    {
      uri: "/ens/ipfs.web3api.eth",
      plugin: ipfsPlugin({
        provider: "http://localhost:5001"
      }),
    },
    {
      uri: '/ens/graph-node.web3api.eth',
      plugin: graphNodePlugin({
        provider: "http://localhost:8000",
      }),
    },
  ]
}


function App() {

  const [polywrapPlugins, setPolywrapPlugins] = useState(
    [] as { uri: string; plugin: PluginPackage }[]
  )

  if (polywrapPlugins.length === 0) {
    getPolywrapPlugins().then((plugins) => {
      setPolywrapPlugins(plugins)
    })
    return <p>Loading polywrap plugins...</p>
  }

  return (
    <div className="App">
      <header className="App-header">
        <p>Squad Content Directory</p>
      </header>

      <MetaMaskProvider>
        <Web3ApiProvider plugins={polywrapPlugins}>
          <ApolloProvider client={apolloClient}>
            <ContentPage />
          </ApolloProvider>
        </Web3ApiProvider>
      </MetaMaskProvider>


    </div>
  )
}

export default App

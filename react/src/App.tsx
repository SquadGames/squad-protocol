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

//import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
//import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
//import { ensPlugin } from "@web3api/ens-plugin-js"
//import { Web3ApiProvider } from '@web3api/react'

const apolloClient = new ApolloClient({
  uri: 'http://localhost:8000/subgraphs/name/squadgames/squad-POC-subgraph',
  cache: new InMemoryCache()
})

function getPolywrapPlugins() {
  return "get polywrap plugins"
  // fetch providers from dev server
  const ipfs = "http://localhost:5001"
  const ethereum = "http://localhost:8545"
  const ensAddress = "0x630589690929E9cdEFDeF0734717a9eF3Ec7Fcfe"

  return [
    {
      uri: "/ens/ens.web3api.eth",
      plugin: ensPlugin({
        addresses: {
          testnet: ensAddress
        }
      })
    },
    {
      uri: "/ens/ethereum.web3api.eth",
      plugin: ethereumPlugin({
        networks: {
          testnet: {
            provider: ethereum,
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
        provider: ipfs
      }),
    },
    {
      uri: 'ens/graph-node.web3api.eth',
      plugin: graphNodePlugin({
        provider: "http://localhost:8000"
      })
    }
  ]
}

function App() {
  return <p>{Math.random()}</p>
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [pageNumber, setPageNumber] = useState(0)
  const [polywrapPlugins, setPolywrapPlugins] = useState([])

  function handleItemsPerPageChange(event) {
    const value = event.target.value
    setItemsPerPage(value)
  }
  console.log(polywrapPlugins)
  if (polywrapPlugins.length === 0) {
//    console.log(getPolywrapPlugins())
    return <p>Loading Polywrap Plugins...</p>
  }

  console.log(polywrapPlugins)

  return (
    <div className="App">
      <header className="App-header">
        <p>Squad Content Directory</p>
      </header>

      <ApolloProvider client={apolloClient}>
        <ContentPage />
      </ApolloProvider>

      <Web3ApiProvider plugins={polywrapPlugins}>
        <p> web3 api provided </p>
      </Web3ApiProvider>

    </div>
  )
}

export default App

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

import { Web3ApiClient } from '@web3api/client-js'
import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ensPlugin } from "@web3api/ens-plugin-js"

console.log(Web3ApiClient)

const apolloClient = new ApolloClient({
  uri: 'http://localhost:8000/subgraphs/name/squadgames/squad-POC-subgraph',
  cache: new InMemoryCache()
})

function App() {
  const [polywrapPlugins, setPolywrapPlugins] = useState([])

  console.log(polywrapPlugins)
  if (polywrapPlugins.length === 0) {
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

    </div>
  )
}

export default App

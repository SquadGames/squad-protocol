import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  useQuery,
  gql
} from "@apollo/client"

const apolloClient = new ApolloClient({
  uri: 'http://localhost:8000/subgraphs/name/squadgames/squad-POC-subgraph',
  cache: new InMemoryCache()
})

ReactDOM.render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
  document.getElementById('root')
)

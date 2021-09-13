import React, { useState } from 'react'
import logo from './logo.svg'
import './App.css'

import { ContentPage } from './content'

function App() {
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [pageNumber, setPageNumber] = useState(0)

  function handleItemsPerPageChange(event) {
    const value = event.target.value
    setItemsPerPage(value)
  }

  return (
    <div className="App">
      <header className="App-header">
        <p>Squad Content Directory</p>
      </header>

      <ContentPage />

    </div>
  )
}

export default App

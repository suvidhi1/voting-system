App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

  init: async function() {
    return await App.initWeb3();
  },

  initWeb3: async function() {
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (error) {
        console.error("User denied account access");
      }
    } else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
      web3 = new Web3(window.web3.currentProvider);
    } else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: async function() {
    const election = await $.getJSON("Election.json");
    App.contracts.Election = TruffleContract(election);
    App.contracts.Election.setProvider(App.web3Provider);

    App.listenForEvents();

    return App.render();
  },

  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      instance.votedEvent({}, { fromBlock: 0, toBlock: 'latest' }).watch(function(error, event) {
        console.log("Event triggered", event);
        App.render();
      });
    }).catch(err => console.error(err));
  },

  render: async function() {
    let electionInstance;
    let loader = $("#loader");
    let content = $("#content");
    loader.show();
    content.hide();

    // Load account data
    web3.eth.getCoinbase((err, account) => {
      if (!err) {
        App.account = account;
        $("#accountAddress").html("Your Account: " + account);
      }
    });

    try {
      electionInstance = await App.contracts.Election.deployed();
      let candidatesCount = (await electionInstance.candidatesCount()).toNumber();
      
      let candidatesResults = $("#candidatesResults");
      let candidatesSelect = $('#candidatesSelect');
      candidatesResults.empty();
      candidatesSelect.empty();

      let promises = [];
      
      for (let i = 1; i <= candidatesCount; i++) {
        promises.push(electionInstance.candidates(i).then(candidate => {
          let id = candidate[0].toNumber();
          let name = candidate[1];
          let voteCount = candidate[2].toNumber();

          let candidateTemplate = `<tr><th>${id}</th><td>${name}</td><td>${voteCount}</td></tr>`;
          candidatesResults.append(candidateTemplate);

          let candidateOption = `<option value="${id}">${name}</option>`;
          candidatesSelect.append(candidateOption);
        }));
      }

      await Promise.all(promises);
      let hasVoted = await electionInstance.voters(App.account);

      if (hasVoted) {
        $('form').hide();
      }
      loader.hide();
      content.show();
    } catch (error) {
      console.error(error);
    }
  },

  castVote: async function() {
    let candidateId = $('#candidatesSelect').val();
    try {
      let instance = await App.contracts.Election.deployed();
      await instance.vote(candidateId, { from: App.account });
      $("#content").hide();
      $("#loader").show();
    } catch (err) {
      console.error(err);
    }
  }
};

$(function() {
  $(window).load(function() {
    App.init();
  });
});

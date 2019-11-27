/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const Request = require('sync-request');

const MySyncModule = require('./syncConnectionToDB');
const Location = require('./model/location');

const today = new Date().toLocaleDateString();
const myUrl = "https://www.unibo.it/UniboWeb/Utils/OrarioLezioni/RestService.aspx?SearchType=OccupazioneAule&Data="+today+"&Edificio=EST_EXZUCC1";
// console.log(myUrl);

const locations = MySyncModule.executeSyncQuery("SELECT Nome, Descrizione, Posti FROM informazioni", (error, result) => {
  if (error) {
    throw error;
  }
  const locs = [];
  result.forEach(item => {
    // new Location(locName, locDescription, locRoomNumber, locLevel, locFloor, locSeats)
    var name = item.Nome;
    var description = item.Descrizione;
    var roomNumeber = null;
    var level;
    var floor;
    var seats = item.Posti;
    if (item.Nome.includes("-")) {
      name = item.Nome.split("-")[1];
      if (item.Nome.startsWith("S")) {
        roomNumeber = item.Nome.split(" ")[1];
      } else {
        roomNumeber = item.Nome.split("-")[0].split(" ")[0];
      }
      switch(roomNumeber.substring(0, 1)) {
        case '1':
          level = 1;
          floor = 'piano interrato';
          break;
        case '2':
          level = 2;
          floor = 'piano terra';
          break;
        case '3':
          level = 3;
          floor = 'primo piano';
          break;
        case '4':
          level = 4;
          floor = 'secondo piano';
          break;
      }
    }
    if (typeof level === "undefined") {
      if (description.includes("piano interrato")) {
        level = 1;
        floor = 'piano interrato';
      } else if (description.includes("piano terra")) {
        level = 2;
        floor = 'piano terra';
      } else if (description.includes("primo piano")) {
        level = 3;
        floor = 'primo piano';
      } else if (description.includes("secondo piano")) {
        level = 4;
        floor = 'secondo piano';
      } else {
        level = null;
        floor = null;
      }
    }
    locs.push(new Location(name, description, roomNumeber, level, floor, seats));
  });
  return locs;
});
// console.log(locations[83]);

const professors = [];
locations.forEach(item => {
  if (item.description().includes("Ufficio")) {
    if (item.name().includes(",")) {
      var names = item.name().split(",");
      names.forEach(name => {
        professors.push(name);
      });
    } else {
      professors.push(item.name());
    }
  }
});
// console.log(professors);

const activities = [];
var res = Request('GET', myUrl);
const body = res.getBody().toString('utf8');
body.split("<Evento>").forEach(item => {
  if (!item.includes("?xml")) {
    activities.push(item.split("<Descrizione>")[1].split("<")[0]);
  }
});
// console.log(activities);

// ==============================================================================================================================================================

const GetNewFactHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechOutput = 'Benvenuto nel Campus di Cesena! Cosa posso fare per te?';
    console.log(speechOutput);    
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .getResponse();
  },
};

const StartedPathFinderHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === "IntentRequest"
      && request.intent.name === "PathFinderIntent"
      && request.dialogState !== 'COMPLETED';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .addDelegateDirective()
      .getResponse();
  }
}

const CompletedPathFinderHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === "IntentRequest"
      && request.intent.name === "PathFinderIntent"
      && request.dialogState === 'COMPLETED';
  },
  handle(handlerInput) {
    const destination = handlerInput.requestEnvelope.request.intent.slots.destination.value;
    const disability = handlerInput.requestEnvelope.request.intent.slots.disability.value;
    var speechOutput = `mi dispiace ma non capisco: ${destination}. Prova semplicemente a dirmi il nome dell'aula, del laboratorio o del professore da cui devi andare oppure dimmi il nome preciso della lezione o dell'evento a cui devi partecipare`;
    var isLocation = false;
    locations.forEach(item => {
      const locaName = item.name();
      if(destination.includes(locaName)) {
        isLocation = true;
        if (disability.includes('no') || disability.includes('nesssuna')) {
          speechOutput = `per raggiungere ${locaName} devi ...`;
        } else {
          speechOutput = `per raggiungere ${locaName} con disabilità ${disability}, devi ...`;
        }
      }
    });
    
    if(!isLocation) {
      var professorName;
      var thereIsProf = false;
      professors.forEach(prof => {
        if(destination.includes(prof)) {
          professorName = `${prof}`;
          thereIsProf = true;
          speechOutput = `mi hai chiesto dove si trova il prof ${professorName}`;
        }
      });
      
      activities.forEach(activity => {
        if(destination.includes(activity)) {
          speechOutput = `mi hai chiesto dove si trova ${activity}`;
          if(thereIsProf) {
            speechOutput = speechOutput + ` del prof ${professorName}`;
          }
        }
      });
      /*
      // l'ho messo direttamente dentro a: if(!isLocation)
      if(!isAnActivity && thereIsProf) {
        speechOutput = `mi hai chiesto dove si trova il prof ${professorName}`
      }
      */
    }
    
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .getResponse();
  }
}

const TimeTableHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === "IntentRequest"
      && request.intent.name === "TimeTableIntent";
  },
  handle(handlerInput) {
    const destination = handlerInput.requestEnvelope.request.intent.slots.destination.value;
    var speechOutput = `mi dispiace ma non capisco: ${destination}`;    
    var isLocation = false;
    locations.forEach(item => {
      if(destination.includes(item)) {
        isLocation = true;
        speechOutput = `mi hai chiesto l'orario per: ${item}`;
      }
    });
    
    if(!isLocation) {
      var professorName;
      var thereIsProf = false;
      professors.forEach(profItem => {
        if(destination.includes(profItem)) {
          professorName = `${profItem}`;
          thereIsProf = true;
          speechOutput = `mi hai chiesto l'orario per il prof: ${professorName}`;
        }
      });
      
      // var isAnActivity = false;
      activities.forEach(actItem => {
        if(destination.includes(actItem)) {
          // isAnActivity = true;
          speechOutput = `mi hai chiesto l'orario per: ${actItem}`;
          if(thereIsProf) {
            speechOutput = speechOutput + ` del prof ${professorName}`
          }
        }
      });
      /*
      // l'ho messo direttamente dentro a: if(!isLocation)
      if(!isAnActivity && thereIsProf) {
        speechOutput = `mi hai chiesto l'orario per il prof: ${professorName}`
      }
      */
    }
    
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .getResponse();
  }
}

const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Goodbye!')
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    return handlerInput.responseBuilder
      .speak(`Sorry, an error occurred: ${error.message}`)
      .reprompt(`Sorry, an error occurred: ${error.message}`)
      .getResponse();
  },
};

const HELP_MESSAGE = 'You can say tell me a space fact, or, you can say exit... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';

const skillBuilder = Alexa.SkillBuilders.standard();

exports.handler = skillBuilder
  .addRequestHandlers(
    GetNewFactHandler,
    StartedPathFinderHandler,
    CompletedPathFinderHandler,
    TimeTableHandler,
    HelpHandler,
    ExitHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();

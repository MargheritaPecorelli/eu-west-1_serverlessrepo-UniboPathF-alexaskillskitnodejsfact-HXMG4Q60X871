/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const Request = require('sync-request');

const MySyncModule = require('./syncConnectionToDB');
const Location = require('./model/location');

const today = new Date().toLocaleDateString();
const myUrl = "https://www.unibo.it/UniboWeb/Utils/OrarioLezioni/RestService.aspx?SearchType=OccupazioneAule&Data="+today+"&Edificio=EST_EXZUCC1";
// console.log(myUrl);

const res = Request('GET', myUrl);
const body = res.getBody().toString('utf8');

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
// console.log(locations);

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
body.split("<Evento>").forEach(item => {
  if (!item.includes("?xml")) {
    activities.push(item.split("<Descrizione>")[1].split("<")[0]);
  }
});
// console.log(activities);

const classroomsWithActivities = [];
body.split("<Aula>").forEach(item => {
  if (!item.includes("?xml")) {
    classroomsWithActivities.push(item.split("<Descrizione>")[1].split("<")[0]);
  }
});
// console.log(classroomsWithActivities);

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

    // cerco se nella stanza che ha richiesto (es un aula) c'è qualche evento oggi
    var isClassWithAct = false;
    classroomsWithActivities.forEach(classroom => {
      if(destination.includes(classroom.toLowerCase())) {
        isClassWithAct = true;
        speechOutput = `oggi in ${classroom} ci si terranno i seguenti eventi: `;
        var previousItem;
        const events = [];
        const eventsTimetables = [];
        body.split("<Aula>").forEach(item => {
          if (item.split("<Descrizione>")[1].split("<")[0] === classroom) {
            events.push(previousItem.split("<Evento>")[1].split("<Descrizione>")[1].split("<")[0]);
            eventsTimetables.push(previousItem.split("<Evento>")[1].split("<OraInizio>")[1].split("<")[0]);
            eventsTimetables.push(previousItem.split("<Evento>")[1].split("<OraFine>")[1].split("<")[0]);
          }
          previousItem = item;
        });
        var index = 0;
        events.forEach(item => {
          // console.log(`${item} in ${classroom} inizia alle ${eventsTimetables[index]} e finisce alle ${eventsTimetables[index+1]}`);
          speechOutput = speechOutput + `${item} che inizia alle ${eventsTimetables[index]} e finisce alle ${eventsTimetables[index+1]}, `;
          index = index + 2;
        });
        if (disability.includes('no') || disability.includes('nesssuna')) {
          speechOutput = speechOutput + `. Per raggiungere ${classroom} devi ...`;
        } else {
          speechOutput = `per raggiungere ${classroom} con disabilità ${disability}, devi ...`;
        }
      }
    });

    // se non c'è nulla, cerco se la stanza che ha richiesto è tra quelle che conosco
    if(!isClassWithAct) {
      var isLocation = false;
      locations.forEach(item => {
        const locaName = item.name().toLowerCase().substring(1);
        if(destination.includes(locaName)) {
          isLocation = true;
          speechOutput = `oggi in ${locaName} non si terrà alcun evento o lezione, ma se vuoi raggiungere ${locaName}`;
          if (disability.includes('no') || disability.includes('nesssuna')) {
            speechOutput = speechOutput + ` devi ...`;
          } else {
            speechOutput = speechOutput + ` con disabilità ${disability}, devi ...`;
          }
        }
      });
    }
    
    //se non è nessuna delle 2 precedenti, allora controllo se mi ha chiesto il nome di un prof
    if(!isLocation && !isClassWithAct) {
      var professorName;
      var thereIsProf = false;
      professors.forEach(prof => {
        if(destination.includes(prof)) {
          professorName = `${prof}`;
          thereIsProf = true;
          speechOutput = `mi hai chiesto dove si trova il prof ${professorName}`;
        }
      });
      
      //guardo se mi ha detto anche il nome di un'attività
      activities.forEach(activity => {
        if(destination.includes(activity)) {
          speechOutput = `mi hai chiesto dove si trova ${activity}`;
          if(thereIsProf) {
            speechOutput = speechOutput + ` del prof ${professorName}`;
          }
        }
      });
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
